-- Adicionar campo acompanhamento_id na notifications_queue se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'notifications_queue' 
    AND column_name = 'acompanhamento_id'
  ) THEN
    ALTER TABLE public.notifications_queue 
    ADD COLUMN acompanhamento_id UUID REFERENCES public.unidades_acompanhamento(id);
    
    CREATE INDEX IF NOT EXISTS idx_notifications_queue_acompanhamento_id 
    ON public.notifications_queue(acompanhamento_id);
  END IF;
END $$;

-- Inserir templates de mensagem para lembretes de reunião
INSERT INTO public.message_templates (template_key, template_content, description, variables, is_active) VALUES
(
  'reuniao_lembrete_1_dia',
  E'🔔 *Lembrete de Reunião - 1 Dia*\n\nOlá {{unidade_nome}}! 👋\n\nEste é um lembrete de que você tem uma reunião agendada amanhã:\n\n📅 Data/Hora: {{data_reuniao}}\n👤 Com: {{responsavel_nome}}\n\nPor favor, confirme sua presença e prepare os pontos que deseja discutir.\n\nAté amanhã! 🤝',
  'Template de lembrete de reunião enviado 1 dia antes',
  '["unidade_nome", "responsavel_nome", "data_reuniao"]'::jsonb,
  true
),
(
  'reuniao_lembrete_1_hora',
  E'⏰ *Lembrete de Reunião - 1 Hora*\n\nOlá {{unidade_nome}}! 👋\n\nSua reunião começa em 1 hora:\n\n📅 Data/Hora: {{data_reuniao}}\n👤 Com: {{responsavel_nome}}\n\nPrepare-se e garanta que está com tudo pronto para a reunião.\n\nNos vemos em breve! 🤝',
  'Template de lembrete de reunião enviado 1 hora antes',
  '["unidade_nome", "responsavel_nome", "data_reuniao"]'::jsonb,
  true
),
(
  'reuniao_lembrete_15_minutos',
  E'🚨 *Lembrete de Reunião - 15 Minutos*\n\nOlá {{unidade_nome}}! 👋\n\nSua reunião começa em 15 minutos:\n\n📅 Data/Hora: {{data_reuniao}}\n👤 Com: {{responsavel_nome}}\n\nEstamos quase lá! Prepare-se para começar.\n\nNos vemos já! 🤝',
  'Template de lembrete de reunião enviado 15 minutos antes',
  '["unidade_nome", "responsavel_nome", "data_reuniao"]'::jsonb,
  true
)
ON CONFLICT (template_key) DO UPDATE SET
  template_content = EXCLUDED.template_content,
  description = EXCLUDED.description,
  variables = EXCLUDED.variables,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- Criar cron job para scheduler de lembretes (a cada 15 minutos)
SELECT cron.schedule(
  'meeting-reminder-scheduler',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/meeting-reminder-scheduler',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Criar cron job para processar lembretes (a cada 5 minutos)
SELECT cron.schedule(
  'process-meeting-notifications',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://hryurntaljdisohawpqf.supabase.co/functions/v1/process-meeting-notifications',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDcwODg3MzksImV4cCI6MjA2MjY2NDczOX0.gcxKFR1H4E1hpg17zAc17ESmje_m0vHV-IsKaqZKmxk"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);
