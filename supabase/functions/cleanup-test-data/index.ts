// Using native Deno.serve (no import needed)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Cliente normal para verificar permissões
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verificar se o usuário está autenticado
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error('User not authenticated');
    }

    console.log('🔍 Current user:', user.id, user.email);

    // Verificar se é admin/diretoria usando função do banco
    const { data: hasPermission, error: permError } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin'
    });

    if (permError) {
      console.error('Error checking permissions:', permError);
      throw new Error('Error checking permissions');
    }

    if (!hasPermission) {
      throw new Error('Insufficient permissions. Only admins can cleanup test data.');
    }

    // Cliente admin para operações de deleção
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('✅ Admin permissions verified, starting cleanup...');

    // Contar registros antes da deleção
    const counts: Record<string, number> = {};

    // Contar tickets e dependências
    const { count: ticketsCount } = await supabaseAdmin.from('tickets').select('*', { count: 'exact', head: true });
    counts.tickets = ticketsCount || 0;

    const { count: mensagensCount } = await supabaseAdmin.from('ticket_mensagens').select('*', { count: 'exact', head: true });
    counts.ticket_mensagens = mensagensCount || 0;

    const { count: auditCount } = await supabaseAdmin.from('tickets_audit').select('*', { count: 'exact', head: true });
    counts.tickets_audit = auditCount || 0;

    const { count: criseLinksCount } = await supabaseAdmin.from('crise_ticket_links').select('*', { count: 'exact', head: true });
    counts.crise_ticket_links = criseLinksCount || 0;

    const { count: faqLogsCount } = await supabaseAdmin.from('faq_logs').select('*', { count: 'exact', head: true });
    counts.faq_logs = faqLogsCount || 0;

    const { count: aiFeedbackCount } = await supabaseAdmin.from('ai_feedback').select('*', { count: 'exact', head: true });
    counts.ai_feedback = aiFeedbackCount || 0;

    const { count: notificationsCount } = await supabaseAdmin.from('notifications_queue').select('*', { count: 'exact', head: true });
    counts.notifications_queue = notificationsCount || 0;

    const { count: escalationCount } = await supabaseAdmin.from('escalation_logs').select('*', { count: 'exact', head: true });
    counts.escalation_logs = escalationCount || 0;

    // Contar chamados e dependências
    const { count: chamadosCount } = await supabaseAdmin.from('chamados').select('*', { count: 'exact', head: true });
    counts.chamados = chamadosCount || 0;

    const { count: avaliacoesCount } = await supabaseAdmin.from('avaliacoes_atendimento').select('*', { count: 'exact', head: true });
    counts.avaliacoes_atendimento = avaliacoesCount || 0;

    // Contar crises
    const { count: crisesCount } = await supabaseAdmin.from('crises').select('*', { count: 'exact', head: true });
    counts.crises = crisesCount || 0;

    const { count: criseMensagensCount } = await supabaseAdmin.from('crise_mensagens').select('*', { count: 'exact', head: true });
    counts.crise_mensagens = criseMensagensCount || 0;

    const { count: criseUpdatesCount } = await supabaseAdmin.from('crise_updates').select('*', { count: 'exact', head: true });
    counts.crise_updates = criseUpdatesCount || 0;

    const { count: crisesAtivasCount } = await supabaseAdmin.from('crises_ativas').select('*', { count: 'exact', head: true });
    counts.crises_ativas = crisesAtivasCount || 0;

    console.log('📊 Registros a serem deletados:', counts);

    // Iniciar deleção em ordem segura (respeitando foreign keys)
    console.log('🗑️ Iniciando deleção...');

    // 1. Deletar mensagens de tickets
    const { error: mensagensError } = await supabaseAdmin
      .from('ticket_mensagens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (mensagensError) console.error('Error deleting ticket_mensagens:', mensagensError);

    // 2. Deletar audit de tickets
    const { error: auditError } = await supabaseAdmin
      .from('tickets_audit')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (auditError) console.error('Error deleting tickets_audit:', auditError);

    // 3. Deletar links de crise
    const { error: criseLinksError } = await supabaseAdmin
      .from('crise_ticket_links')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (criseLinksError) console.error('Error deleting crise_ticket_links:', criseLinksError);

    // 4. Deletar FAQ logs
    const { error: faqError } = await supabaseAdmin
      .from('faq_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (faqError) console.error('Error deleting faq_logs:', faqError);

    // 5. Deletar AI feedback
    const { error: feedbackError } = await supabaseAdmin
      .from('ai_feedback')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (feedbackError) console.error('Error deleting ai_feedback:', feedbackError);

    // 6. Deletar notifications queue
    const { error: notificationsError } = await supabaseAdmin
      .from('notifications_queue')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (notificationsError) console.error('Error deleting notifications_queue:', notificationsError);

    // 7. Deletar escalation logs
    const { error: escalationError } = await supabaseAdmin
      .from('escalation_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (escalationError) console.error('Error deleting escalation_logs:', escalationError);

    // 8. Deletar avaliações de atendimento
    const { error: avaliacoesError } = await supabaseAdmin
      .from('avaliacoes_atendimento')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (avaliacoesError) console.error('Error deleting avaliacoes_atendimento:', avaliacoesError);

    // 9. Deletar mensagens de crise
    const { error: criseMensagensError } = await supabaseAdmin
      .from('crise_mensagens')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (criseMensagensError) console.error('Error deleting crise_mensagens:', criseMensagensError);

    // 10. Deletar updates de crise
    const { error: criseUpdatesError } = await supabaseAdmin
      .from('crise_updates')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (criseUpdatesError) console.error('Error deleting crise_updates:', criseUpdatesError);

    // 11. Deletar crises ativas
    const { error: crisesAtivasError } = await supabaseAdmin
      .from('crises_ativas')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (crisesAtivasError) console.error('Error deleting crises_ativas:', crisesAtivasError);

    // 12. Deletar crises
    const { error: crisesError } = await supabaseAdmin
      .from('crises')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (crisesError) console.error('Error deleting crises:', crisesError);

    // 13. Deletar tickets
    const { error: ticketsError } = await supabaseAdmin
      .from('tickets')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (ticketsError) console.error('Error deleting tickets:', ticketsError);

    // 14. Deletar chamados
    const { error: chamadosError } = await supabaseAdmin
      .from('chamados')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (chamadosError) console.error('Error deleting chamados:', chamadosError);

    // 15. Resetar sequences
    const { error: sequencesError } = await supabaseAdmin
      .from('ticket_sequences')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (sequencesError) console.error('Error deleting ticket_sequences:', sequencesError);

    console.log('✅ Deleção concluída!');

    // Registrar log da operação
    const { error: logError } = await supabaseClient.rpc('log_system_action', {
      p_tipo_log: 'acao_humana',
      p_entidade_afetada: 'cleanup_test_data',
      p_entidade_id: 'full_cleanup',
      p_acao_realizada: 'Limpeza completa de dados de teste executada',
      p_usuario_responsavel: user.id,
      p_dados_novos: {
        deleted_counts: counts,
        timestamp: new Date().toISOString()
      },
      p_canal: 'edge_function'
    });

    if (logError) {
      console.error('Error logging action:', logError);
    }

    // Retornar estatísticas
    const result = {
      success: true,
      deleted: counts,
      timestamp: new Date().toISOString(),
      executed_by: user.email,
      message: `Limpeza concluída! ${counts.tickets} tickets e ${counts.chamados} chamados foram removidos.`
    };

    console.log('🎯 Cleanup result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Cleanup error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
