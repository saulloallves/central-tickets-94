-- Create RLS policy for franqueados to view their units
CREATE POLICY "Franqueados can view their own units" 
ON public.unidades 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 
    FROM public.franqueados f
    JOIN public.profiles p ON p.email = f.email
    WHERE p.id = auth.uid()
    AND (
      -- Handle JSONB object format
      (jsonb_typeof(f.unit_code) = 'object' AND f.unit_code ? unidades.codigo_grupo::text)
      OR
      -- Handle JSONB array format  
      (jsonb_typeof(f.unit_code) = 'array' AND f.unit_code @> to_jsonb(unidades.codigo_grupo))
    )
  )
);