
-- 1) Enum para estilo (Manual | Diretriz)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'article_estilo') THEN
    CREATE TYPE public.article_estilo AS ENUM ('manual', 'diretriz');
  END IF;
END$$;

-- 2) Novas colunas em documentos (idempotentes)
ALTER TABLE public.documentos
  ADD COLUMN IF NOT EXISTS estilo public.article_estilo,
  ADD COLUMN IF NOT EXISTS classificacao jsonb,
  ADD COLUMN IF NOT EXISTS processado_por_ia boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS ia_modelo text;

-- 3) Backfill de estilo para registros antigos (assumimos 'manual' como default histórico)
UPDATE public.documentos
SET estilo = 'manual'
WHERE estilo IS NULL;

-- 4) Índices para filtro
CREATE INDEX IF NOT EXISTS idx_documentos_categoria ON public.documentos (categoria);
CREATE INDEX IF NOT EXISTS idx_documentos_estilo ON public.documentos (estilo);
