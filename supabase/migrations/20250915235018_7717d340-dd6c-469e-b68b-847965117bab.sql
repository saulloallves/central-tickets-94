-- Criar tabela para configurações do sistema
CREATE TABLE IF NOT EXISTS public.system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir configuração padrão para número DFCom
INSERT INTO public.system_settings (setting_key, setting_value, description)
VALUES 
  ('dfcom_phone_number', '5511999999999', 'Número de telefone fixo para atendimentos DFCom')
ON CONFLICT (setting_key) DO NOTHING;

-- Trigger para atualizar updated_at
CREATE TRIGGER update_system_settings_updated_at
  BEFORE UPDATE ON public.system_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policy para system_settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Apenas admins e diretoria podem gerenciar configurações
CREATE POLICY "Admins and diretoria manage system_settings"
  ON public.system_settings
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'diretoria'::app_role));