-- Tabela para controlar mensagens já processadas e evitar duplicação
CREATE TABLE IF NOT EXISTS chat_rag_processed_messages (
  message_id TEXT PRIMARY KEY,
  instance_id TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para limpeza automática de mensagens antigas
CREATE INDEX idx_chat_rag_processed_created 
  ON chat_rag_processed_messages(created_at);

-- Função para limpeza automática (mensagens > 7 dias)
CREATE OR REPLACE FUNCTION cleanup_old_processed_messages()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM chat_rag_processed_messages
  WHERE created_at < NOW() - INTERVAL '7 days';
END;
$$;