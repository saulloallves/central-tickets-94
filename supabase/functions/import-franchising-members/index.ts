import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FranchisingMember {
  email: string;
  full_name: string;
  phone: string;
  user_type: 'Administrator' | 'Regular User';
  member_status: 'active' | 'inactive';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    const { members } = await req.json();

    if (!members || !Array.isArray(members)) {
      throw new Error('Dados inválidos: esperado array de membros');
    }

    const results = {
      success: [] as string[],
      errors: [] as { email: string; error: string }[],
      skipped: [] as { email: string; reason: string }[],
    };

    for (const member of members as FranchisingMember[]) {
      try {
        // Verificar se o usuário já existe no Auth
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const userExists = existingUser?.users.find(u => u.email === member.email);

        if (userExists) {
          results.skipped.push({ 
            email: member.email, 
            reason: 'Usuário já existe no Auth' 
          });
          continue;
        }

        // Verificar se o profile já existe
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id')
          .eq('email', member.email)
          .maybeSingle();

        if (existingProfile) {
          results.skipped.push({ 
            email: member.email, 
            reason: 'Profile já existe' 
          });
          continue;
        }

        // Gerar senha temporária
        const tempPassword = crypto.randomUUID();

        // Criar usuário no Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: member.email,
          password: tempPassword,
          email_confirm: true,
          user_metadata: {
            full_name: member.full_name,
            phone: member.phone,
          }
        });

        if (authError) {
          throw authError;
        }

        const userId = authData.user.id;

        // Criar profile com flag de importação
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            email: member.email,
            nome_completo: member.full_name,
            telefone: member.phone,
            is_imported_user: true,
          });

        if (profileError) {
          throw profileError;
        }

        // Atribuir role baseado no user_type (auto-aprovado)
        const role = member.user_type === 'Administrator' ? 'admin' : 'colaborador';
        
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: userId,
            role: role,
            approved: true,
          });

        if (roleError) {
          throw roleError;
        }

        // Enviar email de redefinição de senha (redireciona para /first-access)
        // URL do app (não do Supabase)
        const appUrl = 'https://hryurntaljdisohawpqf.lovable.app';
        const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(
          member.email,
          {
            redirectTo: `${appUrl}/first-access`,
          }
        );

        if (resetError) {
          console.error('Erro ao enviar email de redefinição:', resetError);
        }

        // Log da ação
        await supabaseAdmin.from('logs_de_sistema').insert({
          tipo_log: 'sistema',
          entidade_afetada: 'users',
          entidade_id: userId,
          acao_realizada: `Usuário importado via CSV`,
          dados_novos: {
            email: member.email,
            full_name: member.full_name,
            role: role,
            is_imported_user: true,
          },
          canal: 'web',
        });

        results.success.push(member.email);

      } catch (error: any) {
        console.error(`Erro ao importar ${member.email}:`, error);
        results.errors.push({
          email: member.email,
          error: error.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Importação concluída: ${results.success.length} criados, ${results.skipped.length} ignorados, ${results.errors.length} erros`,
        results,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Erro na importação:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
