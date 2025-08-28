-- Habilitar realtime para a tabela tickets
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;

-- Habilitar realtime para ticket_mensagens  
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_mensagens;

-- Garantir que a tabela tickets tenha replica identity full para realtime completo
ALTER TABLE tickets REPLICA IDENTITY FULL;

-- Garantir que a tabela ticket_mensagens tenha replica identity full
ALTER TABLE ticket_mensagens REPLICA IDENTITY FULL;