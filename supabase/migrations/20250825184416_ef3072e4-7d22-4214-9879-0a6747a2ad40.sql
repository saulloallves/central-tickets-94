-- Inserir franqueado de teste para login
INSERT INTO public.franqueados (phone, web_password, email, name) 
VALUES ('(11) 99998-1565', 123456, 'franqueado.teste@email.com', 'Franqueado Teste')
ON CONFLICT DO NOTHING;