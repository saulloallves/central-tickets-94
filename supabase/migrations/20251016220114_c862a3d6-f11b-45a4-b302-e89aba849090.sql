-- Tabela para gerenciar grupos WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela para gerenciar admins de grupos WhatsApp
CREATE TABLE IF NOT EXISTS public.whatsapp_group_admins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  nome TEXT,
  is_active BOOLEAN DEFAULT true,
  added_at TIMESTAMPTZ DEFAULT now(),
  added_by UUID REFERENCES auth.users(id),
  UNIQUE(group_id, phone)
);

-- Tabela para histórico de ações nos grupos
CREATE TABLE IF NOT EXISTS public.whatsapp_group_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.whatsapp_groups(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('abrir', 'fechar', 'add_admin', 'remove_admin', 'update_settings')),
  performed_by UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_whatsapp_groups_status ON public.whatsapp_groups(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_admins_group ON public.whatsapp_group_admins(group_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_group_actions_group ON public.whatsapp_group_actions(group_id);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_whatsapp_groups_updated_at
  BEFORE UPDATE ON public.whatsapp_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies
ALTER TABLE public.whatsapp_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_group_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_group_actions ENABLE ROW LEVEL SECURITY;

-- Admins podem ver e gerenciar tudo
CREATE POLICY "Admins podem gerenciar grupos"
  ON public.whatsapp_groups
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem gerenciar admins de grupos"
  ON public.whatsapp_group_admins
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins podem ver histórico de ações"
  ON public.whatsapp_group_actions
  FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));