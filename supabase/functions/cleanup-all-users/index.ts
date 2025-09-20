import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
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
      throw new Error('Insufficient permissions. Only admins can cleanup users.');
    }

    // Cliente admin para deletar usuários do auth
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

    // 1. Buscar todos os usuários exceto o atual
    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, email, nome_completo')
      .neq('id', user.id);

    if (profilesError) {
      throw new Error(`Error fetching profiles: ${profilesError.message}`);
    }

    console.log(`📊 Found ${profiles?.length || 0} users to remove`);

    let removedCount = 0;
    const errors: string[] = [];

    // 2. Para cada usuário, fazer limpeza completa
    for (const profile of profiles || []) {
      try {
        console.log(`🗑️ Removing user: ${profile.email} (${profile.id})`);

        // a) Remover do banco público usando nossa função
        const { error: cleanupError } = await supabaseClient.rpc('remove_user_completely', {
          p_user_id: profile.id
        });

        if (cleanupError) {
          console.error(`Error in remove_user_completely for ${profile.email}:`, cleanupError);
          // Continuar mesmo com erro na limpeza do banco público
        }

        // b) Remover do auth.users usando Admin API
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);

        if (authDeleteError) {
          console.error(`Error deleting auth user ${profile.email}:`, authDeleteError);
          errors.push(`${profile.email}: ${authDeleteError.message}`);
        } else {
          console.log(`✅ Successfully removed: ${profile.email}`);
          removedCount++;
        }

      } catch (error) {
        console.error(`💥 Error removing user ${profile.email}:`, error);
        errors.push(`${profile.email}: ${error.message}`);
      }
    }

    // 3. Log final da operação
    const { error: logError } = await supabaseClient.rpc('log_system_action', {
      p_tipo_log: 'acao_humana',
      p_entidade_afetada: 'cleanup_all_users',
      p_entidade_id: 'complete_cleanup',
      p_acao_realizada: `Limpeza completa executada - ${removedCount} usuários removidos`,
      p_usuario_responsavel: user.id,
      p_dados_novos: {
        removed_count: removedCount,
        errors: errors,
        timestamp: new Date().toISOString()
      },
      p_canal: 'edge_function'
    });

    if (logError) {
      console.error('Error logging action:', logError);
    }

    const result = {
      success: true,
      current_user_id: user.id,
      current_user_email: user.email,
      removed_count: removedCount,
      errors: errors,
      message: errors.length > 0 
        ? `Limpeza parcialmente concluída. ${removedCount} usuários removidos com ${errors.length} erros.`
        : `Limpeza concluída com sucesso! ${removedCount} usuários removidos completamente.`
    };

    console.log('🎯 Final result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Function error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});