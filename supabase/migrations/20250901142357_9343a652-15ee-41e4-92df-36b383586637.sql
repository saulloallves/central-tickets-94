-- Adicionar foreign key para vincular criado_por à tabela profiles
ALTER TABLE public.documentos 
ADD CONSTRAINT fk_documentos_criado_por 
FOREIGN KEY (criado_por) REFERENCES public.profiles(id);