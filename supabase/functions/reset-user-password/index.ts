import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ResetPasswordRequest {
  email: string;
  newPassword: string;
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

    const { email, newPassword }: ResetPasswordRequest = await req.json();

    console.log('Resetando senha para usuário:', email);

    // Buscar o usuário
    const { data: users, error: getUserError } = await supabaseClient.auth.admin.listUsers();
    
    if (getUserError) {
      console.error('Erro ao buscar usuários:', getUserError);
      throw getUserError;
    }

    const user = users.users.find(u => u.email === email);
    
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Resetar a senha usando admin API
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      user.id,
      { 
        password: newPassword,
        email_confirm: true
      }
    );

    if (updateError) {
      console.error('Erro ao atualizar senha:', updateError);
      throw updateError;
    }

    console.log('Senha resetada com sucesso para:', email);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Senha resetada com sucesso!',
        userId: user.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no reset de senha:', error);
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