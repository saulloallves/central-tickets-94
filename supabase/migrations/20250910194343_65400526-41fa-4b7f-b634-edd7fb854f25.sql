-- Create recipients for existing internal notification
INSERT INTO public.internal_notification_recipients (notification_id, user_id)
SELECT 
  in_notif.id as notification_id,
  em.user_id
FROM internal_notifications in_notif
JOIN equipe_members em ON em.equipe_id = in_notif.equipe_id AND em.ativo = true
WHERE in_notif.id = '1fcd8947-6a97-4bf2-9c9a-0c1c2ff378aa'
ON CONFLICT (notification_id, user_id) DO NOTHING;