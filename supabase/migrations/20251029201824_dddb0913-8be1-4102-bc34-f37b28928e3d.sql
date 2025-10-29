-- Enable pg_cron and pg_net extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create function to check kb-audit cron job status
CREATE OR REPLACE FUNCTION public.check_kb_audit_cron_status()
RETURNS TABLE (
  jobname TEXT,
  schedule TEXT,
  active BOOLEAN,
  last_run TIMESTAMPTZ
) 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    j.jobname::TEXT,
    j.schedule::TEXT,
    j.active,
    (SELECT max(end_time) FROM cron.job_run_details WHERE jobid = j.jobid) as last_run
  FROM cron.job j
  WHERE j.jobname = 'kb-audit-hourly';
END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.check_kb_audit_cron_status() TO authenticated;

-- Remove existing cron job if exists
SELECT cron.unschedule('kb-audit-hourly') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'kb-audit-hourly'
);

-- Schedule kb-audit to run every hour
SELECT cron.schedule(
  'kb-audit-hourly',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT net.http_post(
      url:='https://hryurntaljdisohawpqf.supabase.co/functions/v1/kb-audit',
      headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYzNTE3MTEsImV4cCI6MjA1MTkyNzcxMX0.m9dE_JnKC9lZMYkF9gTkUtxp0C7UtGg-uxH3qOUk2Sg"}'::jsonb,
      body:='{"source": "cron_schedule"}'::jsonb
  ) as request_id;
  $$
);