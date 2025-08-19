
-- 1) Sanitiza qualquer referência de equipe inválida
UPDATE public.tickets t
SET equipe_responsavel_id = NULL
WHERE equipe_responsavel_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.equipes e
    WHERE e.id = t.equipe_responsavel_id
  );

-- 2) Cria índice para performance em consultas por equipe
CREATE INDEX IF NOT EXISTS idx_tickets_equipe_responsavel_id
  ON public.tickets (equipe_responsavel_id);

-- 3) Adiciona a chave estrangeira para habilitar o relacionamento no PostgREST
ALTER TABLE public.tickets
ADD CONSTRAINT tickets_equipe_responsavel_id_fkey
FOREIGN KEY (equipe_responsavel_id)
REFERENCES public.equipes (id)
ON UPDATE CASCADE
ON DELETE SET NULL;
