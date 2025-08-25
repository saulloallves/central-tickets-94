-- First, let's check if unidades table already exists and create simple policies
DROP POLICY IF EXISTS "Supervisores can view their unidades" ON public.unidades;

-- Create a simpler policy that avoids the problematic cast
CREATE POLICY "Supervisores can view their unidades" 
ON public.unidades 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'supervisor'::app_role) AND
  EXISTS (
    SELECT 1
    FROM franqueados f
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
    AND (f.unit_code->>(id)::text IS NOT NULL OR f.unit_code ? id)
  )
);

-- Insert some basic unidades if the table is empty
INSERT INTO public.unidades (id, nome) 
VALUES 
  ('unidade-001', 'Unidade Central'),
  ('unidade-002', 'Unidade Norte'),
  ('unidade-003', 'Unidade Sul'),
  ('unidade-004', 'Unidade Leste'),
  ('unidade-005', 'Unidade Oeste')
ON CONFLICT (id) DO NOTHING;