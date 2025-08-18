-- Adicionar foreign keys corretas baseadas na estrutura real das tabelas

-- 1. Tickets table foreign keys
ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_unidade 
FOREIGN KEY (unidade_id) REFERENCES public.unidades(id) ON DELETE RESTRICT;

-- franqueado_id pode ser null e deve referenciar a coluna Id (capital) da tabela franqueados
ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_franqueado 
FOREIGN KEY (franqueado_id) REFERENCES public.franqueados(Id) ON DELETE SET NULL;

-- colaborador_id referencia a tabela colaboradores
ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_colaborador 
FOREIGN KEY (colaborador_id) REFERENCES public.colaboradores(id) ON DELETE SET NULL;

-- criado_por referencia profiles
ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_criado_por 
FOREIGN KEY (criado_por) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- escalonado_para referencia profiles
ALTER TABLE public.tickets 
ADD CONSTRAINT fk_tickets_escalonado_para 
FOREIGN KEY (escalonado_para) REFERENCES public.profiles(id) ON DELETE SET NULL;