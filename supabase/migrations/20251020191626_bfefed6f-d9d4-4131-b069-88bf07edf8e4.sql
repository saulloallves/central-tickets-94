-- Função para reabrir tickets (franqueados podem reabrir seus próprios tickets concluídos)
CREATE OR REPLACE FUNCTION reabrir_ticket(
  p_ticket_id UUID,
  p_sla_minutos INT DEFAULT 240
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ticket RECORD;
  v_data_limite TIMESTAMPTZ;
  v_result JSON;
BEGIN
  -- Buscar ticket e verificar se usuário é o franqueado
  SELECT * INTO v_ticket
  FROM tickets
  WHERE id = p_ticket_id
    AND franqueado_id = auth.uid()
    AND status = 'concluido';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Ticket não encontrado ou não pode ser reaberto'
    );
  END IF;

  -- Calcular nova data limite
  v_data_limite := NOW() + (p_sla_minutos || ' minutes')::INTERVAL;

  -- Atualizar ticket
  UPDATE tickets SET
    status = 'aberto',
    status_sla = 'dentro_prazo',
    data_limite_sla = v_data_limite,
    sla_minutos_restantes = p_sla_minutos,
    sla_pausado_mensagem = false,
    sla_pausado_horario = false,
    reaberto_count = COALESCE(reaberto_count, 0) + 1,
    resolvido_em = NULL,
    updated_at = NOW()
  WHERE id = p_ticket_id;

  -- Inserir mensagem de sistema
  INSERT INTO ticket_mensagens (ticket_id, mensagem, direcao, canal)
  VALUES (
    p_ticket_id,
    '🔄 Ticket reaberto pelo franqueado.' || E'\n' ||
    'Novo SLA: ' || p_sla_minutos || ' minutos (' || ROUND(p_sla_minutos/60.0, 1) || 'h)' || E'\n' ||
    'Prazo: ' || TO_CHAR(v_data_limite, 'DD/MM/YYYY "às" HH24:MI'),
    'saida',
    'web'
  );

  RETURN json_build_object(
    'success', true,
    'ticket_id', p_ticket_id,
    'novo_prazo', v_data_limite
  );
END;
$$;

-- Permitir que qualquer usuário autenticado execute
GRANT EXECUTE ON FUNCTION reabrir_ticket(UUID, INT) TO authenticated;

-- Comentário explicativo
COMMENT ON FUNCTION reabrir_ticket IS 'Permite franqueados reabrirem seus próprios tickets concluídos com novo SLA';