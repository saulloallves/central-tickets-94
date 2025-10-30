-- Criar tabela system_logs para auditoria de ações do sistema
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level TEXT NOT NULL CHECK (level IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_metadata_ticket ON system_logs USING GIN ((metadata->'ticket_id'));

-- Comentário explicativo
COMMENT ON TABLE system_logs IS 'Logs de auditoria do sistema: escalonamentos, erros críticos, etc.';
COMMENT ON COLUMN system_logs.level IS 'Nível do log: info, warning, error, critical';
COMMENT ON COLUMN system_logs.metadata IS 'Dados adicionais em formato JSON (ticket_id, codigo_ticket, etc.)';

-- Política RLS (apenas admin pode ver)
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin pode ver system_logs"
  ON system_logs
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));