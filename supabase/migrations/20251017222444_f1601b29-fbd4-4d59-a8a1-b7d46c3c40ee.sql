-- Criar políticas públicas de leitura para acesso mobile sem autenticação

-- Política pública para visualizar UNIDADES (necessário para a página mobile funcionar)
CREATE POLICY "public_mobile_read_unidades"
ON public.unidades
FOR SELECT
TO public
USING (true);

-- Política pública para visualizar TICKETS (necessário para listar tickets da unidade)
CREATE POLICY "public_mobile_read_tickets"
ON public.tickets
FOR SELECT
TO public
USING (true);

-- Política pública para visualizar MENSAGENS (necessário para o chat do ticket)
CREATE POLICY "public_mobile_read_ticket_mensagens"
ON public.ticket_mensagens
FOR SELECT
TO public
USING (true);

-- NOTA: Apenas SELECT é público. INSERT/UPDATE/DELETE continuam protegidos pelas políticas existentes