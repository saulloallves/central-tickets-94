-- Allow 'franqueado_respondeu' type in internal_notifications
ALTER TABLE internal_notifications 
DROP CONSTRAINT IF EXISTS internal_notifications_type_check;

ALTER TABLE internal_notifications 
ADD CONSTRAINT internal_notifications_type_check 
CHECK (type IN ('ticket', 'sla', 'alert', 'info', 'crisis', 'franqueado_respondeu'));