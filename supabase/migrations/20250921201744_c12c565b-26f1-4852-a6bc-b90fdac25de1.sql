-- Add codigo_grupo column to tickets table
ALTER TABLE public.tickets 
ADD COLUMN codigo_grupo bigint;

-- Populate existing tickets with codigo_grupo from unidades table
UPDATE public.tickets 
SET codigo_grupo = u.codigo_grupo
FROM public.unidades u
WHERE tickets.unidade_id = u.id;

-- Create function to automatically populate codigo_grupo
CREATE OR REPLACE FUNCTION public.auto_populate_codigo_grupo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Auto-populate codigo_grupo from unidades table when unidade_id is set
  IF NEW.unidade_id IS NOT NULL THEN
    SELECT codigo_grupo INTO NEW.codigo_grupo
    FROM public.unidades
    WHERE id = NEW.unidade_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Create trigger to auto-populate codigo_grupo on INSERT and UPDATE
DROP TRIGGER IF EXISTS trg_auto_populate_codigo_grupo ON public.tickets;
CREATE TRIGGER trg_auto_populate_codigo_grupo
  BEFORE INSERT OR UPDATE OF unidade_id ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_populate_codigo_grupo();

-- Add index for better performance on grupo queries
CREATE INDEX IF NOT EXISTS idx_tickets_codigo_grupo ON public.tickets(codigo_grupo);