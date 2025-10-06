-- Remove old operating hours columns that are no longer used
-- Keeping operation_mon through operation_sun + operation_hol

ALTER TABLE public.unidades 
  DROP COLUMN IF EXISTS func_seg_sex,
  DROP COLUMN IF EXISTS func_sab,
  DROP COLUMN IF EXISTS func_dom;

-- Add comment to clarify which columns are used for operating hours
COMMENT ON COLUMN public.unidades.operation_mon IS 'Horário de funcionamento na segunda-feira';
COMMENT ON COLUMN public.unidades.operation_tue IS 'Horário de funcionamento na terça-feira';
COMMENT ON COLUMN public.unidades.operation_wed IS 'Horário de funcionamento na quarta-feira';
COMMENT ON COLUMN public.unidades.operation_thu IS 'Horário de funcionamento na quinta-feira';
COMMENT ON COLUMN public.unidades.operation_fri IS 'Horário de funcionamento na sexta-feira';
COMMENT ON COLUMN public.unidades.operation_sat IS 'Horário de funcionamento no sábado';
COMMENT ON COLUMN public.unidades.operation_sun IS 'Horário de funcionamento no domingo';
COMMENT ON COLUMN public.unidades.operation_hol IS 'Horário de funcionamento em feriados';