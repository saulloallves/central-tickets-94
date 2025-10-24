-- Configurar 5 unidades faltantes em atendente_unidades para habilitar "Falar com o Concierge"

-- BOA ESPERANÇA / MG
INSERT INTO atendente_unidades (codigo_grupo, grupo, id_grupo_branco, atendente_id, concierge_phone, concierge_name, ativo, prioridade)
SELECT '1461', 'BOA ESPERANÇA / MG', '120363029855650075-group', 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a', '5511945556224', 'Karol Souza', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atendente_unidades WHERE codigo_grupo = '1461');

-- LOURDES - BELO HORIZONTE / MG
INSERT INTO atendente_unidades (codigo_grupo, grupo, id_grupo_branco, atendente_id, concierge_phone, concierge_name, ativo, prioridade)
SELECT '1182', 'LOURDES - BELO HORIZONTE / MG', '120363047779977162-group', 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a', '5511945556224', 'Karol Souza', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atendente_unidades WHERE codigo_grupo = '1182');

-- SENHOR DO BONFIM / BA
INSERT INTO atendente_unidades (codigo_grupo, grupo, id_grupo_branco, atendente_id, concierge_phone, concierge_name, ativo, prioridade)
SELECT '1635', 'SENHOR DO BONFIM / BA', '120363295806259619-group', 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a', '5511945556224', 'Karol Souza', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atendente_unidades WHERE codigo_grupo = '1635');

-- SERRA / ES
INSERT INTO atendente_unidades (codigo_grupo, grupo, id_grupo_branco, atendente_id, concierge_phone, concierge_name, ativo, prioridade)
SELECT '1430', 'SERRA / ES', '120363131999368844-group', 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a', '5511945556224', 'Karol Souza', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atendente_unidades WHERE codigo_grupo = '1430');

-- TAGUATINGA SUL - BRASÍLIA / DF
INSERT INTO atendente_unidades (codigo_grupo, grupo, id_grupo_branco, atendente_id, concierge_phone, concierge_name, ativo, prioridade)
SELECT '1227', 'TAGUATINGA SUL - BRASÍLIA / DF', '120363029646622244-group', 'e74a4fd5-cbac-4036-ae3a-50f9ef2cb85a', '5511945556224', 'Karol Souza', true, 1
WHERE NOT EXISTS (SELECT 1 FROM atendente_unidades WHERE codigo_grupo = '1227');