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
    console.log('🚀 Colaborador signup iniciado');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    console.log('📦 Body recebido:', requestBody);

    // Buscar metadata do usuário se nome_completo não foi fornecido
    let { userId, email, nome_completo, role, equipe_id }: SignupRequest = requestBody;
    
    if (!nome_completo) {
      console.log('🔍 Buscando nome_completo nos metadados do usuário...');
      const { data: userData, error: userError } = await supabaseClient.auth.admin.getUserById(userId);
      
      if (!userError && userData.user?.user_metadata?.nome_completo) {
        nome_completo = userData.user.user_metadata.nome_completo;
        console.log('✅ Nome encontrado nos metadados:', nome_completo);
      }
    }

    // Validações básicas
    if (!userId || !email || !nome_completo || !role) {
      throw new Error('Dados obrigatórios faltando');
    }

    console.log('✅ Dados validados:', { userId, email, role, equipe_id });

    // 1. Criar ou atualizar o profile (upsert)
    console.log('📝 Criando/atualizando profile...');
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
      console.error('❌ Erro ao criar/atualizar profile:', profileError);
      throw new Error(`Erro no profile: ${profileError.message}`);
    }
    console.log('✅ Profile criado/atualizado com sucesso');

    // 2. Criar role não aprovado e solicitação de acesso à equipe
    console.log('👥 Processando cadastro com equipe...');
    
    // Inserir role NÃO APROVADO (approved = false)
    const { error: roleError } = await supabaseClient
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: role,
        approved: false
      }, {
        onConflict: 'user_id,role'
      });

    if (roleError) {
      console.error('⚠️ Aviso - erro ao criar role:', roleError);
      // Não falhar por isso, pode já existir
    } else {
      console.log('✅ Role criado (não aprovado):', role);
    }

    // Criar solicitação de acesso à equipe (obrigatório para todos)
    if (!equipe_id) {
      throw new Error('Equipe é obrigatória para todos os tipos de usuário');
    }

    console.log('📨 Criando solicitação de acesso à equipe...');
    const { error: requestError } = await supabaseClient
      .from('internal_access_requests')
      .insert({
        user_id: userId,
        equipe_id: equipe_id,
        desired_role: 'member',
        status: 'pending'
      });

    if (requestError) {
      console.error('❌ Erro ao criar solicitação de acesso:', requestError);
      throw new Error(`Erro na solicitação: ${requestError.message}`);
    }

    console.log('✅ Solicitação de acesso criada para equipe:', equipe_id);

    console.log('🎉 Processamento concluído com sucesso!');
    
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Cadastro realizado! Confirme seu email e aguarde aprovação do supervisor da equipe.'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Erro no signup:', error);
    console.error('Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor',
        success: false,
        details: error.stack || 'Sem detalhes adicionais'
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});