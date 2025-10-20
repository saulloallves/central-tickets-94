-- ============================================================================
-- CORREÇÃO DE SEGURANÇA: Remover política que permite acesso público sem filtro
-- ============================================================================
-- 
-- PROBLEMA: A política "public_mobile_read_tickets" permite que qualquer
-- usuário autenticado veja TODOS os tickets, ignorando filtros de equipe.
--
-- SOLUÇÃO: Remover esta política. As outras políticas existentes já garantem
-- o acesso correto:
--   - tickets_admin_select: Admins veem tudo
--   - tickets_diretoria_select: Diretoria vê tudo
--   - tickets_team_members_select: Membros veem apenas tickets da sua equipe
--   - tickets_view_all_permission: Quem tem permissão especial vê tudo
--   - tickets_franqueado_select: Franqueados veem tickets das suas unidades
-- ============================================================================

-- Remover a política problemática
DROP POLICY IF EXISTS "public_mobile_read_tickets" ON tickets;

-- Log da correção de segurança
DO $$
BEGIN
  PERFORM log_system_action(
    'sistema'::log_tipo,
    'tickets',
    'rls_policy_correction',
    'Removida política public_mobile_read_tickets para corrigir vazamento de dados entre equipes',
    NULL, NULL, NULL, NULL, NULL,
    jsonb_build_object(
      'action', 'DROP POLICY',
      'policy_name', 'public_mobile_read_tickets',
      'reason', 'Permitia acesso público sem filtro de equipe',
      'timestamp', now()
    ),
    'web'::log_canal
  );
END $$;

-- ============================================================================
-- VALIDAÇÃO: Políticas RLS ativas após correção
-- ============================================================================
-- 
-- As seguintes políticas garantem o acesso correto aos tickets:
--
-- 1. tickets_admin_select
--    - Permite: Admins
--    - Veem: Todos os tickets
--
-- 2. tickets_diretoria_select
--    - Permite: Diretoria
--    - Veem: Todos os tickets
--
-- 3. tickets_team_members_select
--    - Permite: Membros de equipe
--    - Veem: Apenas tickets da equipe que pertencem
--
-- 4. tickets_view_all_permission
--    - Permite: Usuários com permissão view_all_tickets
--    - Veem: Todos os tickets
--
-- 5. tickets_franqueado_select
--    - Permite: Franqueados
--    - Veem: Apenas tickets das unidades que gerenciam
--
-- ============================================================================