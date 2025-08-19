
-- 1) Adiciona título e campos de início de atendimento ao ticket
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS titulo text;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS atendimento_iniciado_por uuid;

ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS atendimento_iniciado_em timestamp with time zone;

-- Opcionalmente, criamos uma FK amigável para dados consistentes (sem mexer em schemas reservados):
-- Se preferir manter sem FK, remova esta linha abaixo.
ALTER TABLE public.tickets
  ADD CONSTRAINT fk_tickets_atendimento_iniciado_por_profiles
  FOREIGN KEY (atendimento_iniciado_por)
  REFERENCES public.profiles (id)
  ON UPDATE NO ACTION
  ON DELETE SET NULL;
