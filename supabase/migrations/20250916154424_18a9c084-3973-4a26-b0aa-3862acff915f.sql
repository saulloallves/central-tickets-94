-- Criar enum para tipos de atendentes
CREATE TYPE atendente_tipo AS ENUM ('concierge', 'dfcom');

-- Criar enum para status de atendentes
CREATE TYPE atendente_status AS ENUM ('ativo', 'pausa', 'almoco', 'indisponivel', 'inativo');

-- Criar tabela atendentes
CREATE TABLE public.atendentes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  telefone TEXT,
  email TEXT,
  tipo atendente_tipo NOT NULL,
  status atendente_status NOT NULL DEFAULT 'ativo',
  horario_inicio TIME DEFAULT '08:00:00',
  horario_fim TIME DEFAULT '18:00:00',
  capacidade_maxima INTEGER NOT NULL DEFAULT 5,
  capacidade_atual INTEGER NOT NULL DEFAULT 0,
  foto_perfil TEXT,
  observacoes TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela atendente_unidades para relacionamento N:N
CREATE TABLE public.atendente_unidades (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  atendente_id UUID NOT NULL,
  unidade_id TEXT NOT NULL,
  is_preferencial BOOLEAN NOT NULL DEFAULT false,
  prioridade INTEGER DEFAULT 1,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(atendente_id, unidade_id)
);

-- Criar índices para performance
CREATE INDEX idx_atendentes_tipo ON public.atendentes(tipo);
CREATE INDEX idx_atendentes_status ON public.atendentes(status);
CREATE INDEX idx_atendentes_ativo ON public.atendentes(ativo);
CREATE INDEX idx_atendente_unidades_atendente ON public.atendente_unidades(atendente_id);
CREATE INDEX idx_atendente_unidades_unidade ON public.atendente_unidades(unidade_id);
CREATE INDEX idx_atendente_unidades_preferencial ON public.atendente_unidades(is_preferencial);

-- Habilitar RLS
ALTER TABLE public.atendentes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.atendente_unidades ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para atendentes
CREATE POLICY "Admins and diretoria manage atendentes" 
ON public.atendentes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "Colaboradores view active atendentes" 
ON public.atendentes 
FOR SELECT 
USING (ativo = true AND (has_role(auth.uid(), 'colaborador'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role)));

-- Políticas RLS para atendente_unidades
CREATE POLICY "Admins and diretoria manage atendente_unidades" 
ON public.atendente_unidades 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));

CREATE POLICY "Colaboradores view active atendente_unidades" 
ON public.atendente_unidades 
FOR SELECT 
USING (ativo = true AND (has_role(auth.uid(), 'colaborador'::app_role) OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role)));

-- Trigger para updated_at
CREATE TRIGGER update_atendentes_updated_at
BEFORE UPDATE ON public.atendentes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_atendente_unidades_updated_at
BEFORE UPDATE ON public.atendente_unidades
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para calcular capacidade disponível por tipo e unidade
CREATE OR REPLACE FUNCTION public.get_available_capacity(p_tipo atendente_tipo, p_unidade_id TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_capacity INTEGER := 0;
BEGIN
  SELECT COALESCE(SUM(a.capacidade_maxima - a.capacidade_atual), 0)
  INTO total_capacity
  FROM public.atendentes a
  JOIN public.atendente_unidades au ON a.id = au.atendente_id
  WHERE a.tipo = p_tipo
    AND a.status = 'ativo'
    AND a.ativo = true
    AND au.unidade_id = p_unidade_id
    AND au.ativo = true;
    
  RETURN COALESCE(total_capacity, 0);
END;
$$;

-- Função para redistribuir fila quando atendente fica indisponível
CREATE OR REPLACE FUNCTION public.redistribute_queue_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o atendente mudou para status que não pode atender
  IF NEW.status IN ('pausa', 'almoco', 'indisponivel', 'inativo') AND 
     OLD.status = 'ativo' THEN
    
    -- Zerar capacidade atual
    NEW.capacidade_atual := 0;
    
    -- Log da mudança
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'atendentes',
      NEW.id::TEXT,
      'Status alterado para ' || NEW.status || ' - fila redistribuída',
      auth.uid(),
      NULL, NULL, NULL,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'web'::public.log_canal
    );
  END IF;
  
  -- Se o atendente voltou ao ativo
  IF NEW.status = 'ativo' AND OLD.status != 'ativo' THEN
    -- Log da reativação
    PERFORM public.log_system_action(
      'sistema'::public.log_tipo,
      'atendentes',
      NEW.id::TEXT,
      'Atendente reativado - disponível para novos atendimentos',
      auth.uid(),
      NULL, NULL, NULL,
      to_jsonb(OLD),
      to_jsonb(NEW),
      'web'::public.log_canal
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para redistribuição automática
CREATE TRIGGER trigger_redistribute_queue
BEFORE UPDATE ON public.atendentes
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.redistribute_queue_on_status_change();

-- Inserir dados iniciais de exemplo
INSERT INTO public.atendentes (nome, telefone, email, tipo, status, capacidade_maxima) VALUES
('Atendente Concierge 1', '+5511999999001', 'concierge1@exemplo.com', 'concierge', 'ativo', 5),
('Atendente Concierge 2', '+5511999999002', 'concierge2@exemplo.com', 'concierge', 'ativo', 3),
('Atendente DFCom 1', '+5511999999003', 'dfcom1@exemplo.com', 'dfcom', 'ativo', 4),
('Atendente DFCom 2', '+5511999999004', 'dfcom2@exemplo.com', 'dfcom', 'ativo', 6);

-- Associar atendentes com algumas unidades (exemplo)
INSERT INTO public.atendente_unidades (atendente_id, unidade_id, is_preferencial) 
SELECT a.id, 'UNIT001', true
FROM public.atendentes a 
WHERE a.tipo = 'concierge'
LIMIT 2;

INSERT INTO public.atendente_unidades (atendente_id, unidade_id, is_preferencial) 
SELECT a.id, 'UNIT001', false
FROM public.atendentes a 
WHERE a.tipo = 'dfcom'
LIMIT 2;