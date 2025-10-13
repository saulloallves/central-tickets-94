-- Criar tabela de relatórios diários
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date DATE NOT NULL UNIQUE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  -- KPIs Gerais
  total_tickets_abertos INTEGER NOT NULL DEFAULT 0,
  total_tickets_concluidos INTEGER NOT NULL DEFAULT 0,
  total_tickets_em_andamento INTEGER NOT NULL DEFAULT 0,
  taxa_conclusao NUMERIC(5,2),
  
  -- SLA
  tickets_sla_ok INTEGER NOT NULL DEFAULT 0,
  tickets_sla_vencido INTEGER NOT NULL DEFAULT 0,
  percentual_sla NUMERIC(5,2),
  
  -- Performance
  tempo_medio_resolucao_horas NUMERIC(10,2),
  tickets_crise INTEGER NOT NULL DEFAULT 0,
  
  -- Top Performers
  equipe_mais_chamados JSONB,
  unidade_mais_chamados JSONB,
  
  -- Distribuição
  tickets_por_categoria JSONB,
  tickets_por_prioridade JSONB,
  
  -- Status de envio WhatsApp
  whatsapp_enviado BOOLEAN DEFAULT false,
  whatsapp_enviado_em TIMESTAMPTZ,
  whatsapp_erro TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_reports_date ON public.daily_reports(report_date DESC);

-- RLS Policies
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and diretoria view daily_reports"
ON public.daily_reports FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'diretoria'::app_role)
);

-- Habilitar extensões para CRON
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Configurar CRON job para rodar todos os dias às 20h BRT (23h UTC)
SELECT cron.schedule(
  'daily-report-20h-whatsapp',
  '0 23 * * *',
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/generate-daily-report',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);