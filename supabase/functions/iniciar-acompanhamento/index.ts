import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from '../_shared/zapi-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  codigo_grupo: string;
  observacoes?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando acompanhamento...');
    
    const body: RequestBody = await req.json();
    const { codigo_grupo, observacoes } = body;

    if (!codigo_grupo) {
      throw new Error('codigo_grupo é obrigatório');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Inserir registro de acompanhamento
    console.log('📝 Criando registro de acompanhamento para:', codigo_grupo);
    const { data: acompanhamento, error: insertError } = await supabase
      .from('unidades_acompanhamento')
      .insert({
        codigo_grupo,
        status: 'em_acompanhamento',
        observacoes,
        em_acompanhamento: true,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (insertError) {
      console.error('❌ Erro ao criar acompanhamento:', insertError);
      throw insertError;
    }

    console.log('✅ Acompanhamento criado:', acompanhamento.id);

    // 2. Buscar dados da unidade
    console.log('🔍 Buscando dados da unidade...');
    const { data: unidadeWhatsapp } = await supabase
      .from('unidades_whatsapp')
      .select('id_grupo_branco, grupo')
      .eq('codigo_grupo', codigo_grupo)
      .maybeSingle();

    const { data: unidade } = await supabase
      .from('unidades')
      .select('fantasy_name')
      .eq('codigo_grupo', codigo_grupo)
      .maybeSingle();

    const unidadeNome = unidade?.fantasy_name || `Unidade ${codigo_grupo}`;

    // 3. Carregar template
    console.log('📄 Carregando template acompanhamento_iniciado...');
    const { data: template } = await supabase
      .from('message_templates')
      .select('template_content')
      .eq('template_key', 'acompanhamento_iniciado')
      .eq('is_active', true)
      .maybeSingle();

    let whatsappEnviado = false;

    // 4. Enviar WhatsApp se grupo existe e template está ativo
    if (unidadeWhatsapp?.id_grupo_branco && template?.template_content) {
      console.log('📱 Preparando envio WhatsApp para grupo:', unidadeWhatsapp.id_grupo_branco);

      // Formatar data
      const dataInicio = new Date(acompanhamento.created_at);
      const dataFormatada = dataInicio.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Substituir variáveis no template
      const mensagem = template.template_content
        .replace(/\{\{unidade_nome\}\}/g, unidadeNome)
        .replace(/\{\{data_inicio\}\}/g, dataFormatada);

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
            notification_type: 'acompanhamento_iniciado',
            recipient_phone: unidadeWhatsapp.id_grupo_branco,
            message_content: mensagem,
            status: 'sent',
            metadata: {
              acompanhamento_id: acompanhamento.id,
              codigo_grupo,
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
        acompanhamento_id: acompanhamento.id,
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
