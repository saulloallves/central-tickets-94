-- Pausar tickets criados sem pausa correta durante período fora de horário (CORRIGIDO)

DO $$
DECLARE
  is_business_time BOOLEAN;
  tickets_pausados INTEGER := 0;
BEGIN
  -- Verificar se estamos em horário comercial
  is_business_time := is_business_hours();
  
  -- Se estiver FORA do horário comercial, pausar tickets ativos
  IF NOT is_business_time THEN
    -- Atualizar tickets que não estão pausados por horário
    UPDATE tickets
    SET 
      sla_pausado_horario = TRUE,
      sla_pausado_em = COALESCE(sla_pausado_em, NOW()),
      sla_ultima_atualizacao = NOW()
    WHERE status NOT IN ('concluido')
      AND sla_pausado_horario = FALSE
      AND (sla_pausado_mensagem = FALSE OR sla_pausado_mensagem IS NULL);
    
    GET DIAGNOSTICS tickets_pausados = ROW_COUNT;
    
    -- Criar registros de pausa para os tickets
    INSERT INTO pausas_sla (ticket_id, pausa_inicio, motivo, tipo_pausa)
    SELECT 
      t.id,
      NOW(),
      'Pausa corretiva - fora do horário comercial',
      'fora_horario'
    FROM tickets t
    WHERE t.status NOT IN ('concluido')
      AND t.sla_pausado_horario = TRUE
      AND NOT EXISTS (
        SELECT 1 FROM pausas_sla ps
        WHERE ps.ticket_id = t.id 
          AND ps.tipo_pausa = 'fora_horario'
          AND ps.pausa_fim IS NULL
      );
    
    -- Log da correção
    PERFORM log_system_action(
      'sistema'::log_tipo,
      'tickets',
      'bulk_pause',
      'Pausa corretiva em massa - tickets criados durante erro',
      NULL, NULL, NULL, NULL, NULL,
      jsonb_build_object(
        'tickets_pausados', tickets_pausados,
        'motivo', 'fora_horario_comercial',
        'tipo_correcao', 'bug_fix_sla_pausado'
      ),
      'painel_interno'::log_canal
    );
    
    RAISE NOTICE 'Pausados % tickets por estarem fora do horário comercial', tickets_pausados;
  ELSE
    RAISE NOTICE 'Sistema em horário comercial - nenhum ticket pausado';
  END IF;
END $$;