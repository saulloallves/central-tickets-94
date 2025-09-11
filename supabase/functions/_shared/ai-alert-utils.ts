/**
 * AI Alert System utility for Edge Functions
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface AIAlert {
  assistantName: string;
  errorType: 'token_limit' | 'rate_limit' | 'internal_error' | 'no_response' | 'api_error' | 'timeout';
  location: string;
  errorDetails?: string;
  requestPayload?: any;
  responseData?: any;
  ticketId?: string;
  userId?: string;
}

// Detectar tipo de erro automaticamente
export function detectErrorType(error: any, response?: any): AIAlert['errorType'] {
  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code || response?.status;

  if (errorMessage.includes('token') && (errorMessage.includes('limit') || errorMessage.includes('insufficient'))) {
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

// Enviar alerta via Edge Function
export async function sendAIAlert(alert: AIAlert): Promise<void> {
  try {
    console.log('🚨 Enviando alerta de IA:', alert);
    
    const supabase = createClient(supabaseUrl!, supabaseServiceKey!);
    
    const { error } = await supabase.functions.invoke('ai-alert-system', {
      body: {
        assistantName: alert.assistantName,
        errorType: alert.errorType,
        location: alert.location,
        errorDetails: alert.errorDetails,
        requestPayload: alert.requestPayload,
        responseData: alert.responseData,
        timestamp: new Date().toISOString(),
        ticketId: alert.ticketId,
        userId: alert.userId
      }
    });

    if (error) {
      console.error('❌ Erro ao enviar alerta de IA:', error);
    } else {
      console.log('✅ Alerta de IA enviado com sucesso');
    }
  } catch (error) {
    console.error('❌ Falha ao enviar alerta de IA:', error);
    // Não re-lançar o erro para não quebrar o fluxo principal
  }
}

// Wrapper para monitorar funções de IA automaticamente
export async function wrapAIFunction<T>(
  assistantName: string,
  location: string,
  fn: () => Promise<T>,
  ticketId?: string,
  userId?: string,
  requestPayload?: any
): Promise<T> {
  try {
    const result = await fn();
    
    // Verificar se a resposta está vazia ou é inválida
    if (result === null || result === undefined || 
        (typeof result === 'string' && result.trim() === '') ||
        (typeof result === 'object' && Object.keys(result).length === 0)) {
      
      await sendAIAlert({
        assistantName,
        errorType: 'no_response',
        location,
        errorDetails: 'Assistente retornou resposta vazia ou inválida',
        requestPayload,
        responseData: result,
        ticketId,
        userId
      });
    }
    
    return result;
  } catch (error) {
    const errorType = detectErrorType(error);
    
    await sendAIAlert({
      assistantName,
      errorType,
      location,
      errorDetails: error?.message || 'Erro desconhecido',
      requestPayload,
      responseData: error?.response || null,
      ticketId,
      userId
    });
    
    throw error; // Re-lançar o erro para manter comportamento original
  }
}