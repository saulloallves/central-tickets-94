-- Criar políticas específicas para franqueados
-- Política para franqueados visualizarem tickets de suas unidades
DROP POLICY IF EXISTS "Franqueados can view tickets from their units" ON public.tickets;
CREATE POLICY "Franqueados can view tickets from their units" 
ON public.tickets 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'franqueado'::app_role) AND
  unidade_id IN (
    SELECT u.id
    FROM unidades u
    JOIN franqueados f ON f.unit_code ? u.id
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);

-- Política para franqueados criarem tickets em suas unidades
DROP POLICY IF EXISTS "Franqueados can create tickets in their units" ON public.tickets;
CREATE POLICY "Franqueados can create tickets in their units"
ON public.tickets 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'franqueado'::app_role) AND
  unidade_id IN (
    SELECT u.id
    FROM unidades u
    JOIN franqueados f ON f.unit_code ? u.id
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);

-- Política para franqueados atualizarem tickets de suas unidades
DROP POLICY IF EXISTS "Franqueados can update tickets from their units" ON public.tickets;
CREATE POLICY "Franqueados can update tickets from their units"
ON public.tickets 
FOR UPDATE 
TO authenticated
USING (
  has_role(auth.uid(), 'franqueado'::app_role) AND
  unidade_id IN (
    SELECT u.id
    FROM unidades u
    JOIN franqueados f ON f.unit_code ? u.id
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);

-- Política para franqueados visualizarem mensagens de tickets de suas unidades
DROP POLICY IF EXISTS "Franqueados can view messages from their unit tickets" ON public.ticket_mensagens;
CREATE POLICY "Franqueados can view messages from their unit tickets"
ON public.ticket_mensagens 
FOR SELECT 
TO authenticated
USING (
  has_role(auth.uid(), 'franqueado'::app_role) AND
  ticket_id IN (
    SELECT t.id
    FROM tickets t
    JOIN unidades u ON u.id = t.unidade_id
    JOIN franqueados f ON f.unit_code ? u.id
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);

-- Política para franqueados criarem mensagens em tickets de suas unidades
DROP POLICY IF EXISTS "Franqueados can create messages in their unit tickets" ON public.ticket_mensagens;
CREATE POLICY "Franqueados can create messages in their unit tickets"
ON public.ticket_mensagens 
FOR INSERT 
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'franqueado'::app_role) AND
  ticket_id IN (
    SELECT t.id
    FROM tickets t
    JOIN unidades u ON u.id = t.unidade_id
    JOIN franqueados f ON f.unit_code ? u.id
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);