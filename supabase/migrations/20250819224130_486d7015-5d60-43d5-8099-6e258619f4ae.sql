-- Adicionar campo position para ordenação estável
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS position NUMERIC NOT NULL DEFAULT 1000;

-- Criar índice para ordenação por coluna  
CREATE INDEX IF NOT EXISTS tickets_status_position_idx ON public.tickets (status, position);

-- Tabela de transições válidas de status
CREATE TABLE IF NOT EXISTS public.ticket_status_transitions (
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  allowed BOOLEAN NOT NULL DEFAULT true,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_status, to_status)
);

-- Inserir transições permitidas para o sistema atual
INSERT INTO public.ticket_status_transitions (from_status, to_status, allowed, reason) VALUES 
('aberto', 'em_atendimento', true, 'Iniciar atendimento'),
('aberto', 'escalonado', true, 'Escalar sem atendimento'),
('aberto', 'concluido', true, 'Resolver diretamente'),
('em_atendimento', 'escalonado', true, 'Escalar durante atendimento'),
('em_atendimento', 'concluido', true, 'Resolver após atendimento'),
('em_atendimento', 'aberto', true, 'Retornar para triagem'),
('escalonado', 'em_atendimento', true, 'Retomar atendimento'),
('escalonado', 'concluido', true, 'Resolver após escalação'),
('escalonado', 'aberto', true, 'Retornar para triagem'),
('concluido', 'aberto', true, 'Reabrir ticket')
ON CONFLICT (from_status, to_status) DO NOTHING;

-- Trigger: validar transições de status
CREATE OR REPLACE FUNCTION public.enforce_ticket_transition()
RETURNS TRIGGER AS $$
DECLARE
  can_move BOOLEAN;
  transition_reason TEXT;
BEGIN
  -- Só validar se o status mudou
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT allowed, reason INTO can_move, transition_reason
    FROM public.ticket_status_transitions 
    WHERE from_status = OLD.status::text AND to_status = NEW.status::text;
    
    IF can_move IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION 'Transição inválida: % -> %. %', 
        OLD.status, NEW.status, COALESCE(transition_reason, 'Verifique as regras de negócio.')
        USING HINT = 'Ajuste ticket_status_transitions ou revise a lógica.';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_ticket_transition ON public.tickets;
CREATE TRIGGER trg_enforce_ticket_transition 
  BEFORE UPDATE ON public.tickets 
  FOR EACH ROW 
  EXECUTE FUNCTION public.enforce_ticket_transition();

-- Tabela de auditoria para movimentações
CREATE TABLE IF NOT EXISTS public.tickets_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger para auditoria de mudanças importantes
CREATE OR REPLACE FUNCTION public.audit_ticket_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Auditar mudanças de status ou position significativas
  IF TG_OP = 'UPDATE' AND (
    NEW.status IS DISTINCT FROM OLD.status OR 
    ABS(NEW.position - OLD.position) > 0.1
  ) THEN
    INSERT INTO public.tickets_audit (
      ticket_id, 
      action, 
      old_data, 
      new_data, 
      user_id
    ) VALUES (
      NEW.id,
      CASE 
        WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status_change'
        ELSE 'position_change'
      END,
      jsonb_build_object(
        'status', OLD.status,
        'position', OLD.position,
        'updated_at', OLD.updated_at
      ),
      jsonb_build_object(
        'status', NEW.status,
        'position', NEW.position,
        'updated_at', NEW.updated_at
      ),
      auth.uid()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_ticket_changes ON public.tickets;
CREATE TRIGGER trg_audit_ticket_changes 
  AFTER UPDATE ON public.tickets 
  FOR EACH ROW 
  EXECUTE FUNCTION public.audit_ticket_changes();

-- RLS para auditoria  
ALTER TABLE public.tickets_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_status_transitions ENABLE ROW LEVEL SECURITY;

-- Política para auditoria: ver apenas de tickets acessíveis
CREATE POLICY "tickets_audit_select" ON public.tickets_audit 
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tickets t 
    WHERE t.id = tickets_audit.ticket_id 
    AND can_view_ticket(t.unidade_id, t.equipe_responsavel_id)
  )
);

-- Política para transições: leitura pública, só admins editam
CREATE POLICY "transitions_select" ON public.ticket_status_transitions 
FOR SELECT USING (true);

CREATE POLICY "transitions_admin_manage" ON public.ticket_status_transitions 
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));