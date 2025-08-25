-- Create unidades table if it doesn't exist with proper structure
CREATE TABLE IF NOT EXISTS public.unidades (
  id text PRIMARY KEY,
  nome text NOT NULL,
  endereco text,
  telefone text,
  email text,
  responsavel_id uuid,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.unidades ENABLE ROW LEVEL SECURITY;

-- Create policies for unidades
DROP POLICY IF EXISTS "Admins and diretoria can manage all unidades" ON public.unidades;
CREATE POLICY "Admins and diretoria can manage all unidades" 
ON public.unidades 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'diretoria'::app_role));

DROP POLICY IF EXISTS "Supervisores can view their unidades" ON public.unidades;
CREATE POLICY "Supervisores can view their unidades" 
ON public.unidades 
FOR SELECT 
USING (
  public.has_role(auth.uid(), 'supervisor'::app_role) AND
  id IN (
    SELECT unnest(f.unit_code::text[])
    FROM franqueados f
    JOIN profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Authenticated users can view active unidades" ON public.unidades;
CREATE POLICY "Authenticated users can view active unidades" 
ON public.unidades 
FOR SELECT 
USING (ativo = true AND auth.uid() IS NOT NULL);

-- Insert some sample unidades if table is empty
INSERT INTO public.unidades (id, nome) 
SELECT * FROM (VALUES 
  ('unidade-001', 'Unidade Central'),
  ('unidade-002', 'Unidade Norte'),
  ('unidade-003', 'Unidade Sul'),
  ('unidade-004', 'Unidade Leste'),
  ('unidade-005', 'Unidade Oeste')
) AS t(id, nome)
WHERE NOT EXISTS (SELECT 1 FROM public.unidades LIMIT 1);