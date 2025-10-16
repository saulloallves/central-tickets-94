
-- Corrigir id_grupo_branco da Vila Romano na tabela unidades
UPDATE unidades
SET id_grupo_branco = '120363150186788714-group'
WHERE codigo_grupo = '1411' AND (id_grupo_branco IS NULL OR id_grupo_branco = '');

-- Verificar se há outras unidades com id_grupo_branco NULL que existem em atendente_unidades
UPDATE unidades u
SET id_grupo_branco = au.id_grupo_branco
FROM atendente_unidades au
WHERE u.codigo_grupo = au.codigo_grupo
  AND (u.id_grupo_branco IS NULL OR u.id_grupo_branco = '')
  AND au.id_grupo_branco IS NOT NULL
  AND au.id_grupo_branco != '';
