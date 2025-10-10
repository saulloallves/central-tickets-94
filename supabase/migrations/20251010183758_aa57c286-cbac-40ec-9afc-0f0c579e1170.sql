-- Adicionar política RLS para permitir que usuários vejam suas próprias notificações atribuídas
CREATE POLICY "Users can view their assigned notifications"
ON internal_notifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM internal_notification_recipients inr
    WHERE inr.notification_id = internal_notifications.id
    AND inr.user_id = auth.uid()
  )
);