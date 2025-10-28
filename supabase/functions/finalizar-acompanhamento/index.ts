import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from '../_shared/zapi-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  acompanhamento_id: string;
  plano_acao_id?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Finalizando acompanhamento...');
    
    const body: RequestBody = await req.json();
    const { acompanhamento_id, plano_acao_id } = body;

    if (!acompanhamento_id) {
      throw new Error('acompanhamento_id é obrigatório');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date().toISOString();

    // 1. Atualizar acompanhamento
    console.log('📝 Finalizando acompanhamento:', acompanhamento_id);
    const { data: acompanhamento, error: updateError } = await supabase
      .from('unidades_acompanhamento')
      .update({
        em_acompanhamento: false,
        status: 'finalizado',
        finalizado_em: now,
        plano_acao_id: plano_acao_id || null,
        updated_at: now
      })
      .eq('id', acompanhamento_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao finalizar acompanhamento:', updateError);
      throw updateError;
    }

    console.log('✅ Acompanhamento finalizado');

    // 2. Buscar dados da unidade
    console.log('🔍 Buscando dados da unidade...');
    const { data: unidadeWhatsapp } = await supabase
      .from('unidades_whatsapp')
      .select('id_grupo_branco, grupo')
      .eq('codigo_grupo', acompanhamento.codigo_grupo)
      .maybeSingle();

    const { data: unidade } = await supabase
      .from('unidades')
      .select('fantasy_name')
      .eq('codigo_grupo', acompanhamento.codigo_grupo)
      .maybeSingle();

    const unidadeNome = unidade?.fantasy_name || `Unidade ${acompanhamento.codigo_grupo}`;

    // 3. Carregar template
    console.log('📄 Carregando template acompanhamento_finalizado...');
    const { data: template } = await supabase
      .from('message_templates')
      .select('template_content')
      .eq('template_key', 'acompanhamento_finalizado')
      .eq('is_active', true)
      .maybeSingle();

    let whatsappEnviado = false;

    // 4. Enviar WhatsApp se grupo existe e template está ativo
    if (unidadeWhatsapp?.id_grupo_branco && template?.template_content) {
      console.log('📱 Preparando envio WhatsApp para grupo:', unidadeWhatsapp.id_grupo_branco);

      // Formatar data de finalização
      const dataFinalizacao = new Date(acompanhamento.finalizado_em);
      const dataFormatada = dataFinalizacao.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Calcular duração em dias
      const dataInicio = new Date(acompanhamento.created_at);
      const duracaoMs = dataFinalizacao.getTime() - dataInicio.getTime();
      const duracaoDias = Math.ceil(duracaoMs / (1000 * 60 * 60 * 24));

      // Preparar texto do plano de ação (condicional)
      const planoAcaoTexto = plano_acao_id 
        ? '✅ Plano de Ação criado!' 
        : '';

      // Substituir variáveis no template
      const mensagem = template.template_content
        .replace(/\{\{unidade_nome\}\}/g, unidadeNome)
        .replace(/\{\{data_finalizacao\}\}/g, dataFormatada)
        .replace(/\{\{duracao_dias\}\}/g, String(duracaoDias))
        .replace(/\{\{plano_acao_texto\}\}/g, planoAcaoTexto);

      // Enviar via Z-API
      try {
        const zapiConfig = await loadZAPIConfig();
        
        const zapiUrl = `${zapiConfig.baseUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.instanceToken}/send-text`;
        
        const zapiResponse = await fetch(zapiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': zapiConfig.clientToken || ''
          },
          body: JSON.stringify({
            phone: unidadeWhatsapp.id_grupo_branco,
            message: mensagem
          })
        });

        const zapiResult = await zapiResponse.json();
        
        if (zapiResponse.ok) {
          console.log('✅ WhatsApp enviado com sucesso');
          whatsappEnviado = true;

          // Registrar log de notificação
          await supabase.from('notification_logs').insert({
            notification_type: 'acompanhamento_finalizado',
            recipient_phone: unidadeWhatsapp.id_grupo_branco,
            message_content: mensagem,
            status: 'sent',
            metadata: {
              acompanhamento_id,
              codigo_grupo: acompanhamento.codigo_grupo,
              duracao_dias: duracaoDias,
              plano_acao_id,
              zapi_response: zapiResult
            }
          });
        } else {
          console.error('❌ Erro ao enviar WhatsApp:', zapiResult);
        }
      } catch (error) {
        console.error('❌ Erro ao enviar WhatsApp:', error);
      }
    } else {
      console.log('⚠️ Grupo WhatsApp ou template não encontrado, pulando envio');
    }

    return new Response(
      JSON.stringify({
        success: true,
        whatsapp_enviado: whatsappEnviado
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
