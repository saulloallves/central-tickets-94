import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface AIAlert {
  assistantName: string;
  errorType: 'token_limit' | 'rate_limit' | 'internal_error' | 'no_response' | 'api_error' | 'timeout';
  location: string;
  errorDetails?: string;
  requestPayload?: any;
  responseData?: any;
  timestamp?: string;
  ticketId?: string; // UUID
  userId?: string; // UUID
}

async function sendAIAlert(alert: AIAlert): Promise<void> {
  try {
    console.log('🚨 Enviando alerta de IA:', alert);

    // Buscar configuração da unidade TESTES DO MAKE / RJ
    const { data: unidade, error: unidadeError } = await supabase
      .from('unidades')
      .select('id, grupo, codigo_grupo')
      .ilike('grupo', '%TESTES%MAKE%')
      .or('grupo.ilike.%TESTES DO MAKE%,grupo.ilike.%MAKE%RJ%')
      .single();

    if (unidadeError || !unidade) {
      console.error('❌ Unidade TESTES DO MAKE não encontrada:', unidadeError);
      // Fallback: buscar qualquer unidade com "TESTES" no nome
      const { data: fallbackUnidade } = await supabase
        .from('unidades')
        .select('id, grupo, codigo_grupo')
        .ilike('grupo', '%TESTES%')
        .limit(1)
        .single();
      
      if (fallbackUnidade?.codigo_grupo) {
        console.log('📱 Usando unidade fallback:', fallbackUnidade.grupo);
        
        // Buscar id_grupo_branco em unidades_whatsapp
        const { data: whatsappData } = await supabase
          .from('unidades_whatsapp')
          .select('id_grupo_branco')
          .eq('codigo_grupo', fallbackUnidade.codigo_grupo)
          .maybeSingle();
        
        if (whatsappData?.id_grupo_branco) {
          await enviarAlertaWhatsApp(whatsappData.id_grupo_branco, alert);
        } else {
          console.error('❌ Grupo WhatsApp não encontrado para unidade fallback');
        }
      } else {
        console.error('❌ Nenhuma unidade de teste encontrada');
      }
      return;
    }

    if (!unidade.codigo_grupo) {
      console.error('❌ Unidade não tem codigo_grupo configurado');
      return;
    }

    // Buscar id_grupo_branco em unidades_whatsapp
    const { data: whatsappConfig } = await supabase
      .from('unidades_whatsapp')
      .select('id_grupo_branco')
      .eq('codigo_grupo', unidade.codigo_grupo)
      .maybeSingle();

    if (!whatsappConfig?.id_grupo_branco) {
      console.error('❌ Grupo WhatsApp não encontrado para unidade:', unidade.grupo);
      return;
    }

    console.log('✅ Unidade encontrada:', unidade.grupo, 'Grupo:', whatsappConfig.id_grupo_branco);
    
    // Enviar alerta via WhatsApp
    await enviarAlertaWhatsApp(whatsappConfig.id_grupo_branco, alert);

    // Salvar log do alerta
    await supabase
      .from('logs_de_sistema')
      .insert({
        tipo_log: 'sistema',
        entidade_afetada: 'ai_assistants',
        entidade_id: alert.assistantName,
        acao_realizada: `Alerta de IA enviado: ${alert.errorType}`,
        ia_modelo: alert.assistantName,
        prompt_entrada: JSON.stringify(alert.requestPayload),
        resposta_gerada: JSON.stringify(alert.responseData),
        dados_novos: alert,
        canal: 'whatsapp'
      });

  } catch (error) {
    console.error('❌ Erro ao enviar alerta de IA:', error);
    throw error;
  }
}

async function enviarAlertaWhatsApp(grupoId: string, alert: AIAlert): Promise<void> {
  try {
    // Buscar configuração do Z-API
    const { data: zapiConfig, error: zapiError } = await supabase
      .from('messaging_providers')
      .select('instance_id, instance_token, client_token, base_url')
      .eq('provider_name', 'zapi')
      .eq('is_active', true)
      .single();

    if (zapiError || !zapiConfig) {
      console.error('❌ Configuração Z-API não encontrada:', zapiError);
      return;
    }

    // Mapear tipos de erro para emojis e descrições
    const errorMap = {
      token_limit: { emoji: '📊', desc: 'Limite de Tokens Atingido' },
      rate_limit: { emoji: '⏱️', desc: 'Limite de Taxa Excedido' },
      internal_error: { emoji: '💥', desc: 'Erro Interno da API' },
      no_response: { emoji: '🔇', desc: 'Sem Resposta da IA' },
      api_error: { emoji: '🔌', desc: 'Erro de Conexão com API' },
      timeout: { emoji: '⏰', desc: 'Timeout na Requisição' }
    };

    const errorInfo = errorMap[alert.errorType] || { emoji: '❌', desc: 'Erro Desconhecido' };
    
    // Formatar timestamp
    const timestamp = alert.timestamp || new Date().toLocaleString('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    // Construir mensagem de alerta
    const mensagem = `🚨 *ALERTA CRÍTICO DE IA* 🚨

🤖 *Assistente:* ${alert.assistantName}
${errorInfo.emoji} *Erro:* ${errorInfo.desc}
📍 *Local:* ${alert.location}
🕒 *Horário:* ${timestamp}

📄 *Detalhes do Erro:*
${alert.errorDetails || 'Falha na comunicação com o assistente de IA'}

${alert.ticketId ? `🎫 *Ticket:* ${alert.ticketId}` : ''}
${alert.userId ? `👤 *Usuário:* ${alert.userId}` : ''}

⚠️ *Ação necessária:* Verificar configurações e conectividade da IA`;

    // Enviar via Z-API
    const zapiUrl = `${zapiConfig.base_url}/instances/${zapiConfig.instance_id}/token/${zapiConfig.instance_token}/send-text`;
    
    console.log('📱 Enviando para Z-API:', {
      url: zapiUrl,
      phone: grupoId,
      messageLength: mensagem.length
    });

    const response = await fetch(zapiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiConfig.client_token
      },
      body: JSON.stringify({
        phone: grupoId,
        message: mensagem
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Erro ao enviar via Z-API:', errorText);
      throw new Error(`Z-API error: ${response.status} - ${errorText}`);
    }

    const responseData = await response.json();
    console.log('✅ Alerta enviado via WhatsApp:', responseData);

  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error);
    throw error;
  }
}

// Função utilitária para detectar tipos de erro
export function detectErrorType(error: any, response?: any): AIAlert['errorType'] {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code || response?.status;

  if (errorMessage.includes('token') && errorMessage.includes('limit')) {
    return 'token_limit';
  }
  if (errorMessage.includes('rate limit') || errorCode === 429) {
    return 'rate_limit';
  }
  if (errorMessage.includes('timeout') || errorCode === 408) {
    return 'timeout';
  }
  if (errorCode >= 500 && errorCode < 600) {
    return 'internal_error';
  }
  if (errorCode >= 400 && errorCode < 500) {
    return 'api_error';
  }
  if (!response || response === null || response === undefined) {
    return 'no_response';
  }
  
  return 'internal_error';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    if (!body.assistantName || !body.errorType || !body.location) {
      return new Response(JSON.stringify({
        error: 'assistantName, errorType e location são obrigatórios'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const alert: AIAlert = {
      assistantName: body.assistantName,
      errorType: body.errorType,
      location: body.location,
      errorDetails: body.errorDetails,
      requestPayload: body.requestPayload,
      responseData: body.responseData,
      timestamp: body.timestamp,
      ticketId: body.ticketId,
      userId: body.userId
    };

    await sendAIAlert(alert);

    return new Response(JSON.stringify({
      success: true,
      message: 'Alerta de IA enviado com sucesso'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na Edge Function de alerta:', error);
    
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});