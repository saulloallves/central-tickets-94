import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SignupRequest {
  userId: string;
  email: string;
  nome_completo: string;
  role: string;
  equipe_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { userId, email, nome_completo, role, equipe_id }: SignupRequest = await req.json();

    console.log('Processando signup de colaborador:', { userId, email, role, equipe_id });

    // 1. Criar ou atualizar o profile (upsert)
    const { error: profileError } = await supabaseClient
      .from('profiles')
      .upsert({
        id: userId,
        email,
        nome_completo
      }, {
        onConflict: 'id'
      });

    if (profileError) {
      console.error('Erro ao criar/atualizar profile:', profileError);
      throw profileError;
    }

    // 2. Se for colaborador e tiver equipe_id, criar solicitação de acesso
    if (role === 'colaborador' && equipe_id) {
      // Inserir ou atualizar role como colaborador (upsert)
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: 'colaborador'
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) {
        console.error('Erro ao criar/atualizar role:', roleError);
        // Não falhar por isso, pode já existir
      }

      // Criar solicitação de acesso à equipe
      const { error: requestError } = await supabaseClient
        .from('internal_access_requests')
        .insert({
          user_id: userId,
          equipe_id: equipe_id,
          desired_role: 'member',
          status: 'pending'
        });

      if (requestError) {
        console.error('Erro ao criar solicitação de acesso:', requestError);
        throw requestError;
      }

      console.log('Solicitação de acesso criada para equipe:', equipe_id);
    } else {
      // Para outros roles, inserir ou atualizar o role (upsert)
      const { error: roleError } = await supabaseClient
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: role
        }, {
          onConflict: 'user_id,role'
        });

      if (roleError) {
        console.error('Erro ao criar/atualizar role:', roleError);
        throw roleError;
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: role === 'colaborador' && equipe_id 
          ? 'Cadastro realizado! Sua solicitação de acesso à equipe foi enviada para aprovação.'
          : 'Cadastro realizado com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no signup:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor',
        success: false 
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});