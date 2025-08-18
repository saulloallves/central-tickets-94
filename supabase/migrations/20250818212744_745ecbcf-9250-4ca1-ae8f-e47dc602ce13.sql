-- Criar tabela de equipes
CREATE TABLE public.equipes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT NOT NULL,
  introducao TEXT NOT NULL, -- Descrição para a IA entender quando acionar esta equipe
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.equipes ENABLE ROW LEVEL SECURITY;

-- Políticas de RLS
CREATE POLICY "Admins can manage all equipes" 
ON public.equipes 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view active equipes" 
ON public.equipes 
FOR SELECT 
USING (ativo = true AND auth.uid() IS NOT NULL);

-- Trigger para updated_at
CREATE TRIGGER update_equipes_updated_at
BEFORE UPDATE ON public.equipes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir equipes padrão
INSERT INTO public.equipes (nome, descricao, introducao) VALUES
('Jurídico', 'Equipe responsável por questões legais e contratuais', 'Responsável por: contratos, questões legais, documentação jurídica, compliance, questões trabalhistas, processos judiciais, regularização de documentos'),
('Sistema', 'Equipe de TI e suporte técnico', 'Responsável por: problemas de sistema, bugs, falhas técnicas, login, senhas, integração, PDV, impressoras, equipamentos, rede, internet'),
('Mídia', 'Equipe de marketing e comunicação', 'Responsável por: marketing, campanhas, redes sociais, materiais gráficos, site, comunicação visual, branding'),
('Operações', 'Equipe de operações e processos', 'Responsável por: processos operacionais, logística, estoque, fornecedores, procedimentos, treinamentos operacionais'),
('RH', 'Recursos Humanos', 'Responsável por: contratação, demissão, folha de pagamento, benefícios, treinamentos, questões trabalhistas, gestão de pessoas'),
('Financeiro', 'Equipe financeira', 'Responsável por: pagamentos, recebimentos, fluxo de caixa, impostos, contabilidade, relatórios financeiros, conciliação bancária');