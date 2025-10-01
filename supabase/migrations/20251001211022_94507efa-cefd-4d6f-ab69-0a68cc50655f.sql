-- Add is_emergencia column to chamados table
ALTER TABLE public.chamados 
ADD COLUMN IF NOT EXISTS is_emergencia BOOLEAN DEFAULT false;

-- Add emergencia as a valid status value
-- Since status is text type, no enum to modify, just add comment for documentation
COMMENT ON COLUMN public.chamados.status IS 'Valid values: em_fila, em_atendimento, finalizado, emergencia';

-- Create index for faster emergency queries
CREATE INDEX IF NOT EXISTS idx_chamados_is_emergencia ON public.chamados(is_emergencia) WHERE is_emergencia = true;

-- Add trigger to log emergency creation
CREATE OR REPLACE FUNCTION log_emergency_creation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_emergencia = true AND (OLD.is_emergencia IS NULL OR OLD.is_emergencia = false) THEN
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'chamados',
      NEW.id::TEXT,
      'Emergência criada',
      NULL,
      NULL, NULL, NULL,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'whatsapp'::public.log_canal
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_log_emergency_creation
AFTER INSERT OR UPDATE ON public.chamados
FOR EACH ROW
EXECUTE FUNCTION log_emergency_creation();