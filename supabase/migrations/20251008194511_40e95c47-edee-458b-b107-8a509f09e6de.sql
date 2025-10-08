-- Adicionar política para colaboradores inserirem mensagens em tickets
CREATE POLICY "ticket_mensagens_colaborador_insert" 
ON public.ticket_mensagens
FOR INSERT 
TO public
WITH CHECK (
  auth.uid() IS NOT NULL 
  AND has_role(auth.uid(), 'colaborador'::app_role)
);