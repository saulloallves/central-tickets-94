-- Atualizar política RLS para que apenas admins e diretoria vejam solicitações de acesso interno
DROP POLICY IF EXISTS "Users can view internal access notifications" ON public.notifications_queue;

-- Criar política específica para notificações de solicitação de acesso
CREATE POLICY "Admins view internal access requests notifications" 
ON public.notifications_queue 
FOR SELECT 
USING (
  CASE 
    WHEN type = 'internal_access_request' THEN 
      has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role)
    ELSE true 
  END
);