-- Add conversa column to tickets table
ALTER TABLE public.tickets 
ADD COLUMN IF NOT EXISTS conversa jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Backfill existing tickets with conversation data from ticket_mensagens
WITH msgs AS (
  SELECT
    tm.ticket_id,
    jsonb_agg(
      jsonb_build_object(
        'autor', CASE 
          WHEN tm.direcao = 'saida' THEN 'suporte'
          WHEN tm.direcao = 'entrada' THEN 'franqueado'
          ELSE 'interno'
        END,
        'texto', tm.mensagem,
        'timestamp', tm.created_at,
        'canal', tm.canal
      )
      ORDER BY tm.created_at
    ) AS conversa_json
  FROM public.ticket_mensagens tm
  GROUP BY tm.ticket_id
)
UPDATE public.tickets t
SET conversa = COALESCE(m.conversa_json, '[]'::jsonb)
FROM msgs m
WHERE t.id = m.ticket_id
  AND (t.conversa IS NULL OR t.conversa = '[]'::jsonb);