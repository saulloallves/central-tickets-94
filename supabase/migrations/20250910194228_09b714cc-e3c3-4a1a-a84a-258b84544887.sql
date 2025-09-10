-- Test the trigger manually by inserting a test notification
INSERT INTO public.notifications_queue (ticket_id, type, alert_level, payload) 
VALUES (
  '49a8443c-7a5a-4e24-af4a-4a55f3451f3f', 
  'ticket_created', 
  'normal', 
  '{"test": "manual_trigger"}'::jsonb
);