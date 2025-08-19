-- Corrigir políticas RLS da tabela tickets_audit
-- O problema é que não há política de INSERT, mas existe trigger que tenta inserir

-- Primeira, remover a política existente se necessário e recriar
DROP POLICY IF EXISTS "tickets_audit_select" ON public.tickets_audit;

-- Permitir SELECT para usuários que podem ver o ticket
CREATE POLICY "tickets_audit_select" 
ON public.tickets_audit 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM tickets t 
    WHERE t.id = tickets_audit.ticket_id 
    AND can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
  )
);

-- Permitir INSERT para sistemas e usuários autenticados que podem atualizar o ticket
CREATE POLICY "tickets_audit_insert" 
ON public.tickets_audit 
FOR INSERT 
WITH CHECK (
  -- Permitir se for sistema (auth.uid() pode ser null em triggers) 
  -- OU se usuário pode atualizar o ticket
  (auth.uid() IS NULL) OR
  EXISTS (
    SELECT 1 
    FROM tickets t 
    WHERE t.id = tickets_audit.ticket_id 
    AND can_update_ticket(t.unidade_id, t.equipe_responsavel_id)
  )
);