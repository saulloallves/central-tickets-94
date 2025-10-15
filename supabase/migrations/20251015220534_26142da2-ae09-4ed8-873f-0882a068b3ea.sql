-- ================================
-- SISTEMA DE DUPLA PAUSA SLA - VERSÃO 4
-- ================================

-- 1. Adicionar coluna para pausa "fora de horário" (se não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'sla_pausado_horario'
  ) THEN
    ALTER TABLE tickets ADD COLUMN sla_pausado_horario BOOLEAN DEFAULT FALSE;
    
    COMMENT ON COLUMN tickets.sla_pausado_horario IS 
      'Indica se o SLA está pausado por estar fora do horário comercial (18h30-8h30)';
  END IF;
END $$;

-- 2. Verificar se sla_pausado_mensagem existe e tem o comment correto
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' AND column_name = 'sla_pausado_mensagem'
  ) THEN
    COMMENT ON COLUMN tickets.sla_pausado_mensagem IS 
      'Indica se o SLA está pausado porque o suporte foi o último a responder (aguardando resposta do franqueado)';
  END IF;
END $$;

-- 3. Verificar se sla_pausado é GENERATED COLUMN, se não for, converter
DO $$
BEGIN
  -- Verificar se a coluna sla_pausado existe e não é generated
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tickets' 
      AND column_name = 'sla_pausado'
      AND is_generated = 'NEVER'
  ) THEN
    -- Dropar triggers dependentes primeiro
    DROP TRIGGER IF EXISTS trigger_pausas_sla ON tickets;
    DROP TRIGGER IF EXISTS ticket_after_insert ON tickets;
    DROP TRIGGER IF EXISTS ticket_after_update ON tickets;
    
    -- Criar coluna temporária
    ALTER TABLE tickets RENAME COLUMN sla_pausado TO sla_pausado_temp;
    
    -- Criar nova coluna computed
    ALTER TABLE tickets 
    ADD COLUMN sla_pausado BOOLEAN 
    GENERATED ALWAYS AS (sla_pausado_mensagem OR sla_pausado_horario) STORED;
    
    -- Migrar dados: tickets que estavam pausados por horário
    UPDATE tickets
    SET sla_pausado_horario = TRUE
    WHERE sla_pausado_temp = TRUE
      AND sla_pausado_mensagem = FALSE
      AND status IN ('aberto', 'em_atendimento', 'escalonado');
    
    -- Remover coluna temporária (com CASCADE se necessário)
    ALTER TABLE tickets DROP COLUMN sla_pausado_temp CASCADE;
    
    -- Recriar triggers (se existiam)
    -- Nota: Os triggers serão recriados pelas migrations existentes
  END IF;
END $$;

-- 4. Adicionar comment na coluna sla_pausado
COMMENT ON COLUMN tickets.sla_pausado IS 
  'Flag genérica que indica se o SLA está pausado por QUALQUER motivo (computed: mensagem OR horário)';

-- 5. Criar índices para performance (se não existirem)
CREATE INDEX IF NOT EXISTS idx_tickets_sla_pausado_horario 
  ON tickets(sla_pausado_horario) WHERE sla_pausado_horario = TRUE;

CREATE INDEX IF NOT EXISTS idx_tickets_sla_pausado_mensagem 
  ON tickets(sla_pausado_mensagem) WHERE sla_pausado_mensagem = TRUE;

-- 6. Log da migração
INSERT INTO logs_de_sistema (
  tipo_log,
  entidade_afetada,
  entidade_id,
  acao_realizada,
  dados_novos,
  canal
) VALUES (
  'sistema'::log_tipo,
  'tickets',
  'migration_v4',
  'Sistema de dupla pausa SLA implementado',
  jsonb_build_object(
    'sla_pausado_horario', 'Flag para pausa fora de horário',
    'sla_pausado_mensagem', 'Flag para pausa aguardando resposta',
    'sla_pausado', 'Flag genérica computed (mensagem OR horário)',
    'migration_version', 4
  ),
  'web'::log_canal
);