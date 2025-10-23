-- Configurar Guaxupé em atendente_unidades para habilitar "Falar com o Concierge"
-- Primeiro remove se existir
DELETE FROM atendente_unidades WHERE codigo_grupo = '1540';

-- Insere configuração de Guaxupé
INSERT INTO atendente_unidades (
  codigo_grupo,
  grupo,
  id_grupo_branco,
  atendente_id,
  concierge_phone,
  concierge_name,
  ativo,
  prioridade
) VALUES (
  '1540',
  'GUAXUPÉ / MG',
  '120363130266452453-group',
  'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a',
  '5511971658008',
  'Karol Souza',
  true,
  1
);