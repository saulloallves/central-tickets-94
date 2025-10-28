import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from '../_shared/zapi-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  acompanhamento_id: string;
  reuniao_data: string;
  responsavel_nome: string;
  reuniao_link_zoom?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Agendando reunião de acompanhamento...');
    
    const body: RequestBody = await req.json();
    const { acompanhamento_id, reuniao_data, responsavel_nome, reuniao_link_zoom } = body;

    if (!acompanhamento_id || !reuniao_data || !responsavel_nome) {
      throw new Error('Dados obrigatórios faltando');
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // 1. Atualizar acompanhamento
    console.log('📝 Atualizando acompanhamento:', acompanhamento_id);
    const { data: acompanhamento, error: updateError } = await supabase
      .from('unidades_acompanhamento')
      .update({
        reuniao_inicial_data: reuniao_data,
        responsavel_reuniao_nome: responsavel_nome,
        reuniao_link_zoom: reuniao_link_zoom,
        status: 'reuniao_agendada',
        updated_at: new Date().toISOString()
      })
      .eq('id', acompanhamento_id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar acompanhamento:', updateError);
      throw updateError;
    }

    console.log('✅ Acompanhamento atualizado');

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
    console.log('📄 Carregando template reuniao_agendada...');
    const { data: template } = await supabase
      .from('message_templates')
      .select('template_content')
      .eq('template_key', 'reuniao_agendada')
      .eq('is_active', true)
      .maybeSingle();

    let whatsappEnviado = false;

    // 4. Enviar WhatsApp se grupo existe e template está ativo
    if (unidadeWhatsapp?.id_grupo_branco && template?.template_content) {
      console.log('📱 Preparando envio WhatsApp para grupo:', unidadeWhatsapp.id_grupo_branco);

      // Formatar data da reunião
      const dataReuniao = new Date(reuniao_data);
      const dataFormatada = dataReuniao.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Preparar texto do link (condicional)
      const linkTexto = reuniao_link_zoom 
        ? `🔗 Link: ${reuniao_link_zoom}` 
        : '';

      // Substituir variáveis no template
      const mensagem = template.template_content
        .replace(/\{\{unidade_nome\}\}/g, unidadeNome)
        .replace(/\{\{responsavel_nome\}\}/g, responsavel_nome)
        .replace(/\{\{data_reuniao\}\}/g, dataFormatada)
        .replace(/\{\{link_zoom_texto\}\}/g, linkTexto);

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
            notification_type: 'reuniao_agendada',
            recipient_phone: unidadeWhatsapp.id_grupo_branco,
            message_content: mensagem,
            status: 'sent',
            metadata: {
              acompanhamento_id,
              codigo_grupo: acompanhamento.codigo_grupo,
              reuniao_data,
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
