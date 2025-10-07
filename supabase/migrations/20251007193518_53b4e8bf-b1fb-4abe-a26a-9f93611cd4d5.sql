-- Alterar coluna web_password de bigint para text
ALTER TABLE franqueados 
ALTER COLUMN web_password TYPE text 
USING web_password::text;

COMMENT ON COLUMN franqueados.web_password IS 'Senha do sistema para login de franqueados (texto para suportar formatos diversos)';