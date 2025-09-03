-- Fix the crises table by adding missing columns with correct enum values
ALTER TABLE public.crises 
ADD COLUMN IF NOT EXISTS equipe_id UUID REFERENCES public.equipes(id),
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS problem_signature TEXT,
ADD COLUMN IF NOT EXISTS tickets_count INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- Update existing crises to have is_active = true where status is active
UPDATE public.crises 
SET is_active = true 
WHERE status IN ('aberto', 'investigando', 'comunicado', 'mitigado', 'reaberto');

UPDATE public.crises 
SET is_active = false 
WHERE status = 'encerrado';

-- Add trigger to update is_active based on status changes
CREATE OR REPLACE FUNCTION public.update_crise_is_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update is_active based on status
  IF NEW.status IN ('aberto', 'investigando', 'comunicado', 'mitigado', 'reaberto') THEN
    NEW.is_active := true;
  ELSE
    NEW.is_active := false;
    NEW.resolved_at := COALESCE(NEW.resolved_at, now());
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_crise_is_active ON public.crises;
CREATE TRIGGER trigger_update_crise_is_active
  BEFORE UPDATE ON public.crises
  FOR EACH ROW
  EXECUTE FUNCTION public.update_crise_is_active();