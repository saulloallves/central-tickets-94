
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId, descricao, categoria } = await req.json();
    
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Analyzing ticket:', ticketId, descricao.substring(0, 100));

    // Análise de IA para determinar prioridade, categoria e se é crise
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `Você é um assistente especializado em análise de tickets de suporte técnico para franquias. 
            Analise o problema descrito e retorne APENAS um JSON válido com:
            {
              "prioridade": "urgente" | "alta" | "hoje_18h" | "padrao_24h" | "crise",
              "categoria": "juridico" | "sistema" | "midia" | "operacoes" | "rh" | "financeiro" | "outro",
              "subcategoria": "string descritiva",
              "is_crise": boolean,
              "motivo_crise": "string ou null",
              "sla_sugerido_horas": number
            }

            Critérios para CRISE:
            - Sistema completamente fora do ar
            - Perda total de vendas
            - Problemas que afetam múltiplas unidades
            - Ameaças legais ou de clientes
            - Vazamentos de dados

            Critérios para URGENTE:
            - Problemas críticos que impedem operação normal
            - Falhas de sistema com impacto direto nas vendas
            - Problemas de segurança

            Seja preciso e considere o contexto de uma franquia de varejo.`
          },
          {
            role: 'user',
            content: `Descrição do problema: ${descricao}\nCategoria atual: ${categoria || 'não definida'}`
          }
        ],
        max_completion_tokens: 300,
      }),
    });

    const aiData = await response.json();
    console.log('OpenAI response:', aiData);

    if (!aiData.choices || !aiData.choices[0]) {
      throw new Error('Invalid OpenAI response');
    }

    const aiContent = aiData.choices[0].message.content;
    let analysis;
    
    try {
      analysis = JSON.parse(aiContent);
    } catch (e) {
      console.error('Failed to parse AI response:', aiContent);
      // Fallback para análise padrão
      analysis = {
        prioridade: 'padrao_24h',
        categoria: categoria || 'outro',
        subcategoria: 'Análise automática indisponível',
        is_crise: false,
        motivo_crise: null,
        sla_sugerido_horas: 24
      };
    }

    // Calcular data limite do SLA (timezone São Paulo UTC-3)
    const now = new Date();
    const saoPauloOffset = -3 * 60 * 60 * 1000; // UTC-3
    const saoPauloNow = new Date(now.getTime() + saoPauloOffset);
    
    const slaHours = analysis.sla_sugerido_horas || 24;
    const dataLimiteSla = new Date(saoPauloNow.getTime() + (slaHours * 60 * 60 * 1000));
    const slaHalfTime = new Date(saoPauloNow.getTime() + ((slaHours / 2) * 60 * 60 * 1000));

    // Atualizar ticket com análise da IA
    const { error: updateError } = await supabase
      .from('tickets')
      .update({
        prioridade: analysis.prioridade,
        categoria: analysis.categoria,
        subcategoria: analysis.subcategoria,
        data_limite_sla: dataLimiteSla.toISOString(),
        sla_half_time: slaHalfTime.toISOString(),
        log_ia: {
          analysis,
          timestamp: now.toISOString(),
          model: 'gpt-4.1-2025-04-14'
        }
      })
      .eq('id', ticketId);

    if (updateError) {
      console.error('Error updating ticket:', updateError);
      throw updateError;
    }

    // Se for crise, marcar status e escalar imediatamente
    if (analysis.is_crise) {
      console.log('CRISE DETECTADA:', analysis.motivo_crise);
      
      await supabase
        .from('tickets')
        .update({ 
          status: 'escalonado',
          escalonamento_nivel: 5 // Escalar direto para diretoria
        })
        .eq('id', ticketId);

      // Disparar notificação de crise
      await supabase.functions.invoke('process-notifications', {
        body: { 
          ticketId, 
          type: 'crise_detectada',
          priority: 'immediate'
        }
      });
    }

    // Agendar notificação de SLA 50%
    await supabase
      .from('notifications_queue')
      .insert({
        ticket_id: ticketId,
        type: 'sla_half_time',
        scheduled_at: slaHalfTime.toISOString(),
        payload: {
          ticket_id: ticketId,
          sla_percentage: 50
        }
      });

    // Agendar notificação de SLA vencido
    await supabase
      .from('notifications_queue')
      .insert({
        ticket_id: ticketId,
        type: 'sla_vencido',
        scheduled_at: dataLimiteSla.toISOString(),
        payload: {
          ticket_id: ticketId,
          sla_percentage: 100
        }
      });

    console.log('Ticket analysis completed:', analysis);

    return new Response(JSON.stringify({ 
      success: true, 
      analysis,
      sla_deadline: dataLimiteSla.toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in analyze-ticket function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
