import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const webhookData = await req.json();
    console.log('📩 Webhook de avaliação recebido:', JSON.stringify(webhookData, null, 2));

    // Verificar se é uma resposta de botão de avaliação
    if (!webhookData.buttonsResponseMessage?.buttonId) {
      console.log('⚠️ Webhook não é de botão de avaliação, ignorando...');
      return new Response(
        JSON.stringify({ message: 'Webhook ignorado - não é botão de avaliação' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const buttonId = webhookData.buttonsResponseMessage.buttonId;
    const senderPhone = webhookData.participantPhone || webhookData.phone;
    
    console.log(`🔍 Processing button: ${buttonId} from phone: ${senderPhone}`);

    // Extrair informações do buttonId: avaliacao_{rating}_{chamado_id}
    const buttonMatch = buttonId.match(/^avaliacao_(otimo|bom|ruim)_(.+)$/);
    
    if (!buttonMatch) {
      console.log('⚠️ Button ID não corresponde ao padrão de avaliação, ignorando...');
      return new Response(
        JSON.stringify({ message: 'Button ID não reconhecido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const rating = buttonMatch[1]; // otimo, bom, ruim
    const chamadoId = buttonMatch[2];
    
    console.log(`⭐ Avaliação recebida: ${rating} para chamado: ${chamadoId}`);

    // Buscar registro de avaliação existente
    const { data: avaliacaoExistente, error: searchError } = await supabase
      .from('avaliacoes_atendimento')
      .select('*')
      .eq('chamado_id', chamadoId)
      .maybeSingle();

    if (searchError) {
      console.error('❌ Error searching for existing evaluation:', searchError);
      return new Response(
        JSON.stringify({ error: 'Error searching evaluation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!avaliacaoExistente) {
      console.log('⚠️ Nenhuma avaliação pendente encontrada para este chamado');
      return new Response(
        JSON.stringify({ message: 'Nenhuma avaliação pendente encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Atualizar avaliação com o rating recebido
    const { error: updateError } = await supabase
      .from('avaliacoes_atendimento')
      .update({
        rating: rating,
        respondido_em: new Date().toISOString()
      })
      .eq('id', avaliacaoExistente.id);

    if (updateError) {
      console.error('❌ Error updating evaluation:', updateError);
      return new Response(
        JSON.stringify({ error: 'Error updating evaluation' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ Avaliação atualizada com sucesso!');

    // Preparar mensagem de agradecimento baseada na avaliação
    let thankYouMessage = '';
    switch (rating) {
      case 'otimo':
        thankYouMessage = '🌟 *Obrigado pela avaliação!*\n\nFicamos felizes que conseguimos resolver tudo para você! Sua opinião é muito importante para nós.';
        break;
      case 'bom':
        thankYouMessage = '🙂 *Obrigado pela avaliação!*\n\nValorizamos seu feedback e vamos trabalhar para melhorar ainda mais nosso atendimento.';
        break;
      case 'ruim':
        thankYouMessage = '😕 *Obrigado pela avaliação!*\n\nLamentamos que não conseguimos atender suas expectativas. Sua opinião nos ajudará a melhorar.';
        break;
    }

    // Enviar mensagem de agradecimento via Z-API
    const phoneDestino = webhookData.phone;
    console.log(`📤 Enviando mensagem de agradecimento para: ${phoneDestino}`);
    
    try {
      const response = await fetch(`${Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io'}/instances/${Deno.env.get('ZAPI_INSTANCE_ID')}/token/${Deno.env.get('ZAPI_TOKEN')}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': Deno.env.get('ZAPI_CLIENT_TOKEN') || '',
        },
        body: JSON.stringify({
          phone: phoneDestino,
          message: thankYouMessage,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Mensagem de agradecimento enviada com sucesso:', result);
      } else {
        const errorText = await response.text();
        console.error('❌ Falha ao enviar mensagem de agradecimento:', errorText);
      }
    } catch (error) {
      console.error('❌ Erro ao enviar mensagem de agradecimento:', error);
    }

    // Log da avaliação recebida
    await supabase.from('logs_de_sistema').insert({
      tipo_log: 'sistema',
      entidade_afetada: 'avaliacoes_atendimento',
      entidade_id: avaliacaoExistente.id,
      acao_realizada: `Avaliação recebida: ${rating}`,
      usuario_responsavel: null,
      dados_novos: {
        chamado_id: chamadoId,
        rating: rating,
        sender_phone: senderPhone,
        button_id: buttonId,
        webhook_data: webhookData
      },
      canal: 'zapi'
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Avaliação processada com sucesso',
        rating: rating,
        chamado_id: chamadoId,
        thank_you_message: thankYouMessage
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});