-- Add api_key column to faq_ai_settings table
ALTER TABLE public.faq_ai_settings 
ADD COLUMN IF NOT EXISTS api_key text DEFAULT '';