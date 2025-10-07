import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Cache de mensagens processadas recentemente (5 minutos TTL)
const processedMessagesCache = new Map<string, number>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Verifica se uma mensagem já foi processada recentemente
 * Usa cache em memória + banco de dados para deduplicação global
 */
export async function isDuplicateMessage(messageId: string, phone: string): Promise<boolean> {
  if (!messageId) {
    console.log('⚠️ messageId vazio, permitindo processamento');
    return false;
  }

  const cacheKey = `${messageId}_${phone}`;
  const now = Date.now();

  // 1. Verificar cache em memória (rápido)
  const lastProcessed = processedMessagesCache.get(cacheKey);
  if (lastProcessed && (now - lastProcessed) < CACHE_TTL) {
    console.log(`🚫 Mensagem duplicada detectada no cache (messageId: ${messageId})`);
    return true;
  }

  // 2. Verificar no banco de dados (compartilhado entre instâncias)
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const fiveMinutesAgo = new Date(now - CACHE_TTL).toISOString();

    const { data, error } = await supabase
      .from('logs_de_sistema')
      .select('id')
      .eq('entidade_id', messageId)
      .eq('entidade_afetada', 'webhook_deduplication')
      .gte('criado_em', fiveMinutesAgo)
      .limit(1);

    if (error) {
      console.error('❌ Erro ao verificar deduplicação no banco:', error);
      // Em caso de erro, permitir processamento (fail-open)
      return false;
    }

    if (data && data.length > 0) {
      console.log(`🚫 Mensagem duplicada detectada no banco (messageId: ${messageId})`);
      // Atualizar cache local
      processedMessagesCache.set(cacheKey, now);
      return true;
    }

    // 3. Registrar processamento (marca como processada)
    await supabase
      .from('logs_de_sistema')
      .insert({
        tipo_log: 'sistema',
        entidade_afetada: 'webhook_deduplication',
        entidade_id: messageId,
        acao_realizada: 'Mensagem processada',
        dados_novos: { phone, processed_at: new Date().toISOString() }
      });

    // Atualizar cache local
    processedMessagesCache.set(cacheKey, now);

    // Limpar cache antigo (garbage collection)
    for (const [key, timestamp] of processedMessagesCache.entries()) {
      if (now - timestamp > CACHE_TTL) {
        processedMessagesCache.delete(key);
      }
    }

    console.log(`✅ Mensagem ${messageId} registrada como processada`);
    return false;

  } catch (error) {
    console.error('❌ Erro na deduplicação:', error);
    // Em caso de erro, permitir processamento (fail-open)
    return false;
  }
}
