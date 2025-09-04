-- Resolver a crise ativa que está causando o alerta no dashboard
UPDATE crises 
SET 
  status = 'resolvido',
  is_active = false,
  resolved_at = now(),
  ultima_atualizacao = now()
WHERE id = 'd869db4c-810d-4061-bb1f-f0bc04581b22' AND is_active = true;

-- Também verificar se há outras crises ativas antigas (mais de 24h) que devem ser fechadas automaticamente
UPDATE crises 
SET 
  status = 'resolvido',
  is_active = false,
  resolved_at = now(),
  ultima_atualizacao = now()
WHERE is_active = true 
  AND created_at < (now() - interval '24 hours')
  AND status = 'aberto';