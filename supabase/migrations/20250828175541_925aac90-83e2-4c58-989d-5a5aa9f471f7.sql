-- Enable realtime for tickets table
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;

-- Set replica identity to FULL for complete row data during updates
ALTER TABLE tickets REPLICA IDENTITY FULL;

-- Also enable for ticket_mensagens if needed for chat
ALTER PUBLICATION supabase_realtime ADD TABLE ticket_mensagens;
ALTER TABLE ticket_mensagens REPLICA IDENTITY FULL;