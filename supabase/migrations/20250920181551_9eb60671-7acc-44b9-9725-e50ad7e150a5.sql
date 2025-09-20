-- Limpar conversas muito longas para otimizar memória
-- Manter apenas as últimas 20 mensagens de cada conversa
UPDATE public.whatsapp_conversas 
SET conversa = (
  SELECT jsonb_agg(elem ORDER BY (elem->>'moment')::timestamp DESC) 
  FROM (
    SELECT elem 
    FROM jsonb_array_elements(conversa) AS elem 
    ORDER BY (elem->>'moment')::timestamp DESC 
    LIMIT 20
  ) subq
)
WHERE jsonb_array_length(conversa) > 20;