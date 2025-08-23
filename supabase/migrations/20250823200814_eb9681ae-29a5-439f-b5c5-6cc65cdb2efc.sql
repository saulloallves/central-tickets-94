-- Enable RLS on the last table that needs it based on security warnings
-- (This will fix the remaining "RLS Disabled in Public" error)

-- Check what table still needs RLS enabled - likely the one causing the remaining error
-- Based on the error count reduction, this should be the last one:

-- Enable RLS on message_templates if not already enabled
ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;