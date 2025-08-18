-- Create enums for tickets module
CREATE TYPE public.canal_origem AS ENUM ('typebot', 'whatsapp_zapi', 'web');
CREATE TYPE public.ticket_status AS ENUM ('aberto', 'em_atendimento', 'escalonado', 'concluido');
CREATE TYPE public.ticket_categoria AS ENUM ('juridico', 'sistema', 'midia', 'operacoes', 'rh', 'financeiro', 'outro');
CREATE TYPE public.ticket_prioridade AS ENUM ('urgente', 'alta', 'hoje_18h', 'padrao_24h', 'crise');
CREATE TYPE public.ticket_sla_status AS ENUM ('dentro_prazo', 'alerta', 'vencido');
CREATE TYPE public.canal_resposta AS ENUM ('web', 'whatsapp', 'typebot', 'interno');
CREATE TYPE public.mensagem_direcao AS ENUM ('entrada', 'saida', 'interna');

-- Create ticket sequences table for unique code generation
CREATE TABLE public.ticket_sequences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  unidade_id TEXT NOT NULL,
  ano INTEGER NOT NULL,
  ultimo_numero INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(unidade_id, ano)
);

-- Create tickets table
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo_ticket TEXT NOT NULL UNIQUE,
  unidade_id TEXT NOT NULL,
  franqueado_id UUID,
  colaborador_id UUID,
  descricao_problema TEXT NOT NULL,
  canal_origem canal_origem NOT NULL,
  status ticket_status NOT NULL DEFAULT 'aberto',
  categoria ticket_categoria,
  subcategoria TEXT,
  prioridade ticket_prioridade NOT NULL DEFAULT 'padrao_24h',
  data_abertura TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  data_limite_sla TIMESTAMP WITH TIME ZONE,
  equipe_responsavel_id UUID,
  escalonado_para UUID,
  status_sla ticket_sla_status NOT NULL DEFAULT 'dentro_prazo',
  resolvido_em TIMESTAMP WITH TIME ZONE,
  resposta_resolucao TEXT,
  canal_resposta canal_resposta,
  arquivos JSONB DEFAULT '[]'::jsonb,
  criado_por UUID,
  log_ia JSONB DEFAULT '{}'::jsonb,
  reaberto_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create ticket messages table for timeline/chat
CREATE TABLE public.ticket_mensagens (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  usuario_id UUID,
  mensagem TEXT NOT NULL,
  direcao mensagem_direcao NOT NULL DEFAULT 'entrada',
  anexos JSONB DEFAULT '[]'::jsonb,
  canal canal_resposta NOT NULL DEFAULT 'web',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ticket_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_mensagens ENABLE ROW LEVEL SECURITY;

-- Create function to generate unique ticket codes
CREATE OR REPLACE FUNCTION public.next_ticket_code(p_unidade_id TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_year INTEGER := EXTRACT(YEAR FROM now());
  next_num INTEGER;
  ticket_code TEXT;
BEGIN
  -- Insert or update sequence for this unit/year
  INSERT INTO public.ticket_sequences (unidade_id, ano, ultimo_numero)
  VALUES (p_unidade_id, current_year, 1)
  ON CONFLICT (unidade_id, ano)
  DO UPDATE SET 
    ultimo_numero = ticket_sequences.ultimo_numero + 1,
    updated_at = now()
  RETURNING ultimo_numero INTO next_num;
  
  -- Generate ticket code: UNIDADE-YEAR-0001
  ticket_code := p_unidade_id || '-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
  
  RETURN ticket_code;
END;
$$;

-- Create access control functions
CREATE OR REPLACE FUNCTION public.can_view_ticket(ticket_unidade_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      has_role(auth.uid(), 'gerente'::app_role) AND
      ticket_unidade_id IN (
        SELECT u.id
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    ) OR
    (
      ticket_unidade_id IN (
        SELECT c.unidade_id
        FROM colaboradores c
        JOIN profiles p ON p.email = c.email
        WHERE p.id = auth.uid()
      )
    )
$$;

CREATE OR REPLACE FUNCTION public.can_create_ticket(ticket_unidade_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT can_view_ticket(ticket_unidade_id)
$$;

CREATE OR REPLACE FUNCTION public.can_update_ticket(ticket_unidade_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    has_role(auth.uid(), 'admin'::app_role) OR
    (
      has_role(auth.uid(), 'gerente'::app_role) AND
      ticket_unidade_id IN (
        SELECT u.id
        FROM unidades u
        JOIN franqueados f ON f.unit_code ? u.id
        JOIN profiles p ON p.email = f.email
        WHERE p.id = auth.uid()
      )
    )
$$;

-- Create triggers for automatic ticket code generation and business logic
CREATE OR REPLACE FUNCTION public.tickets_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Generate ticket code if not provided
  IF NEW.codigo_ticket IS NULL OR NEW.codigo_ticket = '' THEN
    NEW.codigo_ticket := next_ticket_code(NEW.unidade_id);
  END IF;
  
  -- Set default SLA deadline (24h for padrao_24h, adjust for other priorities)
  IF NEW.data_limite_sla IS NULL THEN
    CASE NEW.prioridade
      WHEN 'urgente' THEN NEW.data_limite_sla := NEW.data_abertura + INTERVAL '2 hours';
      WHEN 'alta' THEN NEW.data_limite_sla := NEW.data_abertura + INTERVAL '4 hours';
      WHEN 'hoje_18h' THEN NEW.data_limite_sla := DATE_TRUNC('day', NEW.data_abertura) + INTERVAL '18 hours';
      WHEN 'crise' THEN NEW.data_limite_sla := NEW.data_abertura + INTERVAL '30 minutes';
      ELSE NEW.data_limite_sla := NEW.data_abertura + INTERVAL '24 hours';
    END CASE;
  END IF;
  
  -- Calculate initial SLA status
  IF now() >= NEW.data_limite_sla THEN
    NEW.status_sla := 'vencido';
  ELSIF now() >= (NEW.data_limite_sla - INTERVAL '2 hours') THEN
    NEW.status_sla := 'alerta';
  ELSE
    NEW.status_sla := 'dentro_prazo';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tickets_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Update timestamp
  NEW.updated_at := now();
  
  -- Set resolution timestamp when completed
  IF NEW.status = 'concluido' AND OLD.status != 'concluido' THEN
    NEW.resolvido_em := now();
  END IF;
  
  -- Handle ticket reopening
  IF OLD.status = 'concluido' AND NEW.status != 'concluido' THEN
    NEW.reaberto_count := OLD.reaberto_count + 1;
    NEW.resolvido_em := NULL;
  END IF;
  
  -- Recalculate SLA status
  IF now() >= NEW.data_limite_sla THEN
    NEW.status_sla := 'vencido';
  ELSIF now() >= (NEW.data_limite_sla - INTERVAL '2 hours') THEN
    NEW.status_sla := 'alerta';
  ELSE
    NEW.status_sla := 'dentro_prazo';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers
CREATE TRIGGER tickets_before_insert_trigger
  BEFORE INSERT ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_before_insert();

CREATE TRIGGER tickets_before_update_trigger
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.tickets_before_update();

CREATE TRIGGER update_ticket_sequences_updated_at
  BEFORE UPDATE ON public.ticket_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ticket_mensagens_updated_at
  BEFORE UPDATE ON public.ticket_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add audit triggers
CREATE TRIGGER audit_ticket_sequences
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_sequences
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_tickets
  AFTER INSERT OR UPDATE OR DELETE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger();

CREATE TRIGGER audit_ticket_mensagens
  AFTER INSERT OR UPDATE OR DELETE ON public.ticket_mensagens
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_trigger();

-- Create RLS policies for ticket_sequences
CREATE POLICY "Admins can manage all ticket_sequences"
  ON public.ticket_sequences
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create RLS policies for tickets
CREATE POLICY "Admins can manage all tickets"
  ON public.tickets
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gerentes can manage tickets in their units"
  ON public.tickets
  FOR ALL
  USING (can_update_ticket(unidade_id));

CREATE POLICY "Colaboradores can view and create tickets in their unit"
  ON public.tickets
  FOR SELECT
  USING (can_view_ticket(unidade_id));

CREATE POLICY "Colaboradores can create tickets in their unit"
  ON public.tickets
  FOR INSERT
  WITH CHECK (can_create_ticket(unidade_id));

-- Create RLS policies for ticket_mensagens
CREATE POLICY "Admins can manage all ticket messages"
  ON public.ticket_mensagens
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view messages for tickets they can access"
  ON public.ticket_mensagens
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE t.id = ticket_mensagens.ticket_id 
      AND can_view_ticket(t.unidade_id)
    )
  );

CREATE POLICY "Users can create messages for tickets they can access"
  ON public.ticket_mensagens
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE t.id = ticket_mensagens.ticket_id 
      AND can_view_ticket(t.unidade_id)
    )
  );

CREATE POLICY "Gerentes can update messages for tickets in their units"
  ON public.ticket_mensagens
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE t.id = ticket_mensagens.ticket_id 
      AND can_update_ticket(t.unidade_id)
    )
  );

-- Create storage bucket for tickets
INSERT INTO storage.buckets (id, name, public) VALUES ('tickets', 'tickets', false);

-- Create storage policies for tickets bucket
CREATE POLICY "Users can view ticket files they have access to"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'tickets' AND
    EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE (storage.foldername(name))[1] = t.id::text
      AND can_view_ticket(t.unidade_id)
    )
  );

CREATE POLICY "Users can upload files to tickets they can access"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tickets' AND
    EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE (storage.foldername(name))[1] = t.id::text
      AND can_view_ticket(t.unidade_id)
    )
  );

CREATE POLICY "Gerentes can delete ticket files in their units"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'tickets' AND
    EXISTS (
      SELECT 1 FROM public.tickets t 
      WHERE (storage.foldername(name))[1] = t.id::text
      AND can_update_ticket(t.unidade_id)
    )
  );

-- Create helpful views for reporting
CREATE VIEW public.v_tickets_por_unidade_mes AS
SELECT 
  t.unidade_id,
  u.grupo as nome_unidade,
  DATE_TRUNC('month', t.created_at) as mes,
  COUNT(*) as total_tickets,
  COUNT(*) FILTER (WHERE t.reaberto_count > 0) as tickets_reabertos,
  AVG(EXTRACT(EPOCH FROM (t.resolvido_em - t.data_abertura))/3600) as tempo_medio_resolucao_horas,
  COUNT(*) FILTER (WHERE t.status_sla = 'vencido') as tickets_sla_vencido
FROM public.tickets t
LEFT JOIN public.unidades u ON u.id = t.unidade_id
GROUP BY t.unidade_id, u.grupo, DATE_TRUNC('month', t.created_at)
ORDER BY mes DESC, t.unidade_id;

CREATE VIEW public.v_tickets_sla_overview AS
SELECT 
  status_sla,
  categoria,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'aberto') as abertos,
  COUNT(*) FILTER (WHERE status = 'em_atendimento') as em_atendimento,
  COUNT(*) FILTER (WHERE status = 'concluido') as concluidos
FROM public.tickets
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY status_sla, categoria
ORDER BY status_sla, categoria;