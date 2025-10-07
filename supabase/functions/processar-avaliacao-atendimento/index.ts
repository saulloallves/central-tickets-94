import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

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
    const phoneDestino = webhookData.phone;
    
    console.log(`🔍 Processing button: ${buttonId} from phone: ${phoneDestino}`);

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
    console.log(`📤 Enviando mensagem de agradecimento para: ${phoneDestino}`);
    
    try {
      const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
      const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
      
      const response = await fetch(zapiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': clientToken,
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