-- Adicionar 'franqueado' ao enum app_role se não existir
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumlabel = 'franqueado' 
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
    ) THEN
        ALTER TYPE app_role ADD VALUE 'franqueado';
    END IF;
END $$;

-- Criar política para franqueados visualizarem tickets de suas unidades
CREATE POLICY IF NOT EXISTS "Franqueados can view tickets from their units" 
ON public.tickets 
FOR SELECT 
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

-- Criar política para franqueados criarem tickets em suas unidades
CREATE POLICY IF NOT EXISTS "Franqueados can create tickets in their units"
ON public.tickets 
FOR INSERT 
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

-- Criar política para franqueados atualizarem tickets de suas unidades
CREATE POLICY IF NOT EXISTS "Franqueados can update tickets from their units"
ON public.tickets 
FOR UPDATE 
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
CREATE POLICY IF NOT EXISTS "Franqueados can view messages from their unit tickets"
ON public.ticket_mensagens 
FOR SELECT 
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
CREATE POLICY IF NOT EXISTS "Franqueados can create messages in their unit tickets"
ON public.ticket_mensagens 
FOR INSERT 
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