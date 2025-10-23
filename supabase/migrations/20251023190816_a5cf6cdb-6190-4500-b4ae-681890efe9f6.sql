
-- Adicionar Vilhena/RO ao sistema de atendente_unidades para permitir "Falar com Concierge"
INSERT INTO atendente_unidades (
  codigo_grupo,
  grupo,
  id_grupo_branco,
  atendente_id,
  concierge_name,
  concierge_phone,
  ativo,
  prioridade
) 
SELECT 
  '1727',
  'VILHENA / RO',
  '120363292686325881-group',
  'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a',
  'Karol Souza',
  '5511971658008',
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM atendente_unidades WHERE codigo_grupo = '1727'
);
