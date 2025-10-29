import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🗑️ Iniciando limpeza total da base de conhecimento...');

    // Criar cliente com service_role para bypass de RLS
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

    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      console.error('❌ Erro de autenticação:', authError);
      return new Response(
        JSON.stringify({ error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`👤 Usuário: ${user.email} (${user.id})`);

    const deletionResults = {
      knowledge_auto_approvals: 0,
      knowledge_suggestions: 0,
      knowledge_articles: 0,
      documentos: 0,
      timestamp: new Date().toISOString(),
      executedBy: user.email,
    };

    // 1. Deletar knowledge_auto_approvals
    console.log('🔄 Deletando knowledge_auto_approvals...');
    const { error: error1, count: count1 } = await supabaseAdmin
      .from('knowledge_auto_approvals')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Deleta tudo

    if (error1) {
      console.error('❌ Erro ao deletar knowledge_auto_approvals:', error1);
    } else {
      deletionResults.knowledge_auto_approvals = count1 || 0;
      console.log(`✅ ${count1 || 0} registros deletados de knowledge_auto_approvals`);
    }

    // 2. Deletar knowledge_suggestions
    console.log('🔄 Deletando knowledge_suggestions...');
    const { error: error2, count: count2 } = await supabaseAdmin
      .from('knowledge_suggestions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error2) {
      console.error('❌ Erro ao deletar knowledge_suggestions:', error2);
    } else {
      deletionResults.knowledge_suggestions = count2 || 0;
      console.log(`✅ ${count2 || 0} registros deletados de knowledge_suggestions`);
    }

    // 3. Deletar knowledge_articles
    console.log('🔄 Deletando knowledge_articles...');
    const { error: error3, count: count3 } = await supabaseAdmin
      .from('knowledge_articles')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error3) {
      console.error('❌ Erro ao deletar knowledge_articles:', error3);
    } else {
      deletionResults.knowledge_articles = count3 || 0;
      console.log(`✅ ${count3 || 0} registros deletados de knowledge_articles`);
    }

    // 4. Deletar documentos
    console.log('🔄 Deletando documentos...');
    const { error: error4, count: count4 } = await supabaseAdmin
      .from('documentos')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (error4) {
      console.error('❌ Erro ao deletar documentos:', error4);
    } else {
      deletionResults.documentos = count4 || 0;
      console.log(`✅ ${count4 || 0} registros deletados de documentos`);
    }

    const totalDeleted = 
      deletionResults.knowledge_auto_approvals +
      deletionResults.knowledge_suggestions +
      deletionResults.knowledge_articles +
      deletionResults.documentos;

    console.log(`🎉 Limpeza concluída! Total: ${totalDeleted} registros deletados`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Base de conhecimento resetada com sucesso',
        results: deletionResults,
        totalDeleted,
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Erro ao resetar base de conhecimento'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
