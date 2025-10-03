import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversionMember {
  email: string;
  full_name: string;
  phone?: string;
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
      throw new Error('Members array is required');
    }

    console.log(`🔄 Iniciando conversão de ${members.length} usuários...`);

    const converted: string[] = [];
    const notFound: string[] = [];
    const errors: Array<{ email: string; error: string }> = [];

    for (const member of members as ConversionMember[]) {
      const email = member.email?.toLowerCase().trim();
      
      if (!email) {
        errors.push({ email: 'unknown', error: 'Email is required' });
        continue;
      }

      try {
        // 1. Buscar usuário no Auth
        const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        
        if (listError) {
          throw listError;
        }

        const user = users.users.find(u => u.email?.toLowerCase() === email);
        
        if (!user) {
          console.log(`❌ Usuário não encontrado: ${email}`);
          notFound.push(email);
          continue;
        }

        console.log(`✅ Usuário encontrado: ${email} (ID: ${user.id})`);

        // 2. Resetar senha para temporária
        const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
          user.id,
          { password: "first-access-temp-2024" }
        );

        if (passwordError) {
          throw new Error(`Erro ao resetar senha: ${passwordError.message}`);
        }

        console.log(`🔑 Senha resetada para: ${email}`);

        // 3. Atualizar profile - marcar como importado
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ is_imported_user: true })
          .eq('id', user.id);

        if (profileError) {
          throw new Error(`Erro ao atualizar profile: ${profileError.message}`);
        }

        console.log(`📝 Profile atualizado: ${email}`);

        // 4. Garantir role de colaborador existe e está aprovada
        const { data: existingRole } = await supabaseAdmin
          .from('user_roles')
          .select('*')
          .eq('user_id', user.id)
          .eq('role', 'colaborador')
          .maybeSingle();

        if (!existingRole) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: user.id,
              role: 'colaborador',
              approved: true
            });

          if (roleError) {
            console.warn(`⚠️ Erro ao criar role (pode já existir): ${roleError.message}`);
          } else {
            console.log(`👤 Role de colaborador criada: ${email}`);
          }
        } else if (!existingRole.approved) {
          // Aprovar role se existir mas não estiver aprovada
          const { error: approveError } = await supabaseAdmin
            .from('user_roles')
            .update({ approved: true })
            .eq('user_id', user.id)
            .eq('role', 'colaborador');

          if (approveError) {
            console.warn(`⚠️ Erro ao aprovar role: ${approveError.message}`);
          } else {
            console.log(`✓ Role de colaborador aprovada: ${email}`);
          }
        }

        // 5. Log da conversão
        await supabaseAdmin.from('logs_de_sistema').insert({
          tipo_log: 'sistema',
          entidade_afetada: 'profiles',
          entidade_id: user.id,
          acao_realizada: 'Usuário convertido para pré-aprovado',
          dados_novos: {
            email,
            is_imported_user: true,
            senha_resetada: true,
            role: 'colaborador'
          },
          canal: 'web'
        });

        converted.push(email);
        console.log(`🎉 Conversão completa: ${email}\n`);

      } catch (error: any) {
        console.error(`❌ Erro ao converter ${email}:`, error);
        errors.push({
          email,
          error: error.message || 'Erro desconhecido'
        });
      }
    }

    console.log(`\n📊 Resumo da conversão:`);
    console.log(`✅ Convertidos: ${converted.length}`);
    console.log(`❌ Não encontrados: ${notFound.length}`);
    console.log(`⚠️ Erros: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        converted,
        notFound,
        errors,
        stats: {
          total: members.length,
          converted: converted.length,
          notFound: notFound.length,
          errors: errors.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro geral na conversão:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message,
        converted: [],
        notFound: [],
        errors: []
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
