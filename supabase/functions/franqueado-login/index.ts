import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phone, password } = await req.json();
    
    if (!phone || !password) {
      return new Response(
        JSON.stringify({ error: 'Telefone e senha são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Normalizar telefone (apenas dígitos)
    const normalizedPhone = phone.replace(/\D/g, '');
    
    if (normalizedPhone.length < 10) {
      return new Response(
        JSON.stringify({ error: 'Telefone deve ter pelo menos 10 dígitos' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Criar cliente Supabase com service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Buscar franqueado por telefone normalizado e senha
    const { data: franqueado, error: franqueadoError } = await supabaseAdmin
      .from('franqueados')
      .select('id, email, name, phone, web_password')
      .eq('normalized_phone', normalizedPhone)
      .eq('web_password', parseInt(password))
      .single();

    if (franqueadoError || !franqueado) {
      console.log('Franqueado não encontrado:', { normalizedPhone, password: '***' });
      return new Response(
        JSON.stringify({ error: 'Telefone ou senha incorretos' }),
        { 
          status: 401, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Franqueado encontrado:', { id: franqueado.id, email: franqueado.email });

    // Verificar se tem email, senão sintetizar um
    let finalEmail = franqueado.email;
    if (!finalEmail) {
      finalEmail = `55${normalizedPhone}@franqueados.local`;
      
      // Atualizar o email do franqueado na tabela
      await supabaseAdmin
        .from('franqueados')
        .update({ email: finalEmail })
        .eq('id', franqueado.id);
      
      console.log('Email sintetizado para franqueado:', finalEmail);
    }

    // Verificar se já existe usuário Auth com este email
    let authUser;
    try {
      const { data: existingUser, error: getUserError } = await supabaseAdmin.auth.admin.getUserByEmail(finalEmail);
      if (!getUserError && existingUser?.user) {
        authUser = existingUser.user;
        console.log('Usuário já existe no Auth:', authUser.id);
      }
    } catch (error) {
      console.log('Erro ao buscar usuário existente:', error);
    }

    // Se não existe, criar usuário no Auth
    if (!authUser) {
      console.log('Usuário não existe no Auth, será criado');
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: finalEmail,
        password: password.toString(),
        email_confirm: true,
        user_metadata: {
          nome_completo: franqueado.name,
          telefone: franqueado.phone
        }
      });

      if (createError) {
        console.error('Erro ao criar usuário:', createError);
        return new Response(
          JSON.stringify({ error: 'Erro interno do servidor' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      authUser = newUser.user;
      console.log('Usuário criado com sucesso:', authUser.id);
    } else {
      // Usuário já existe, apenas sincronizar senha se necessário
      console.log('Sincronizando senha para usuário existente');
      try {
        await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
          password: password.toString()
        });
      } catch (updateError) {
        console.error('Erro ao atualizar senha:', updateError);
      }
    }

    // Garantir perfil na tabela profiles
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authUser.id,
        email: finalEmail,
        nome_completo: franqueado.name,
        telefone: franqueado.phone
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Erro ao criar/atualizar perfil:', profileError);
    }


    // Atribuir role de franqueado (usado pelas RLS para controle de acesso)
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: authUser.id,
        role: 'franqueado'
      }, {
        onConflict: 'user_id,role'
      });

    if (roleError) {
      console.error('Erro ao atribuir role:', roleError);
    }

    // Log da ação
    await supabaseAdmin
      .from('logs_de_sistema')
      .insert({
        tipo_log: 'sistema',
        entidade_afetada: 'franqueados',
        entidade_id: franqueado.id.toString(),
        acao_realizada: 'login_franqueado_ok',
        usuario_responsavel: authUser.id,
        canal: 'web',
        dados_novos: {
          email: franqueado.email,
          telefone_normalizado: normalizedPhone
        }
      });

    return new Response(
      JSON.stringify({ 
        email: finalEmail,
        message: 'Login realizado com sucesso' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Erro no login de franqueado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});