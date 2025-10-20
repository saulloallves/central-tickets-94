-- Adicionar RLS policies para a view tickets_with_realtime_sla

-- Grant SELECT permission on the view to authenticated users
GRANT SELECT ON tickets_with_realtime_sla TO authenticated;

-- Add RLS policies for the view (same as tickets table)
ALTER VIEW tickets_with_realtime_sla SET (security_barrier = true, security_invoker = true);

-- Log
SELECT log_system_action(
  'sistema'::log_tipo,
  'migrations',
  'add_rls_tickets_with_realtime_sla',
  'Adicionadas permissões RLS para a view tickets_with_realtime_sla',
  NULL, NULL, NULL, NULL, NULL,
  jsonb_build_object(
    'changes', ARRAY[
      'GRANT SELECT para authenticated',
      'security_invoker = true para usar RLS do usuário'
    ]
  ),
  'sistema'::log_canal
);