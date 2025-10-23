// Using native Deno.serve (no import needed)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Função para enviar mensagem de teste
async function sendTestMessage(groupId: string, message: string) {
  const zapiInstanceId = '3E4305B20C51F0086DA02EE02AE98ECC';
  const zapiToken = '192935E00458CED4AD4E9118';
  const zapiClientToken = 'F660410ff4e544c24b14b557020ce3f62S';
  const zapiBaseUrl = 'https://api.z-api.io';

  try {
    console.log(`🧪 Enviando mensagem de teste para: ${groupId}`);
    console.log(`📝 Mensagem: ${message}`);

    const response = await fetch(`${zapiBaseUrl}/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiClientToken,
      },
      body: JSON.stringify({
        phone: groupId,
        message: message,
      }),
    });

    const responseText = await response.text();
    console.log(`📡 Status da resposta: ${response.status}`);
    console.log(`📡 Resposta Z-API: ${responseText}`);

    if (!response.ok) {
      console.error('❌ Erro ao enviar via Z-API:', responseText);
      return { success: false, error: responseText, status: response.status };
    }

    console.log('✅ Mensagem de teste enviada com sucesso');
    return { success: true, response: responseText, status: response.status };
  } catch (error) {
    console.error('💥 Erro no envio de teste:', error);
    return { success: false, error: error.message };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { group_id, message = "🧪 **TESTE DE NOTIFICAÇÃO**\n\nEsta é uma mensagem de teste para verificar se as notificações estão funcionando corretamente.\n\n⏰ Enviado em: " + new Date().toLocaleString('pt-BR') } = await req.json();

    if (!group_id) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'group_id é obrigatório',
        example: { group_id: "120363258963635302-group" }
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`🚀 Iniciando teste de notificação para grupo: ${group_id}`);

    // Enviar mensagem de teste
    const result = await sendTestMessage(group_id, message);

    return new Response(JSON.stringify({
      success: result.success,
      group_id,
      message,
      result,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro geral:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});