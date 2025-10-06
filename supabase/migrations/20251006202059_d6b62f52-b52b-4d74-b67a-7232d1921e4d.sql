-- Fix tickets_audit RLS policies and trigger function

-- Drop existing trigger first with CASCADE
DROP TRIGGER IF EXISTS audit_ticket_changes_trigger ON public.tickets CASCADE;
DROP TRIGGER IF EXISTS trg_audit_ticket_changes ON public.tickets CASCADE;
DROP FUNCTION IF EXISTS public.audit_ticket_changes() CASCADE;

-- Recreate audit function with SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.audit_ticket_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Try to get user_id from auth context, fallback to NULL for service role
  BEGIN
    v_user_id := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  -- Auditar mudanças de status ou position significativas
  IF TG_OP = 'UPDATE' AND (
    NEW.status IS DISTINCT FROM OLD.status OR 
    ABS(NEW.position - OLD.position) > 0.1
  ) THEN
    INSERT INTO public.tickets_audit (
      ticket_id, 
      action, 
      old_data, 
      new_data, 
      user_id
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_change'
        ELSE 'position_change'
      END,
      jsonb_build_object(
        'status', OLD.status,
        'position', OLD.position,
        'updated_at', OLD.updated_at
      ),
      jsonb_build_object(
        'status', NEW.status,
        'position', NEW.position,
        'updated_at', NEW.updated_at
      ),
      v_user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER audit_ticket_changes_trigger
  AFTER UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_ticket_changes();

-- Add INSERT policy for tickets_audit to allow system operations
CREATE POLICY "System can insert audit logs"
ON public.tickets_audit
FOR INSERT
WITH CHECK (true);