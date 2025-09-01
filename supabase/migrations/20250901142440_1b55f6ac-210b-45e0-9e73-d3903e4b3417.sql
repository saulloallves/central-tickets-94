-- Primeiro vamos alterar o tipo da coluna criado_por de text para uuid
ALTER TABLE public.documentos 
ALTER COLUMN criado_por TYPE uuid USING criado_por::uuid;

-- Agora criar a foreign key para vincular criado_por à tabela profiles
ALTER TABLE public.documentos 
ADD CONSTRAINT fk_documentos_criado_por 
FOREIGN KEY (criado_por) REFERENCES public.profiles(id);