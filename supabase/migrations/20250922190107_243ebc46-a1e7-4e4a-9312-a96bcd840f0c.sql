-- Configure REPLICA IDENTITY FULL for real-time notifications
ALTER TABLE public.internal_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.internal_notification_recipients REPLICA IDENTITY FULL;