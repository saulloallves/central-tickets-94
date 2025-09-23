import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// External Supabase configuration for franchising_owners table
const EXTERNAL_SUPABASE_URL = "https://hryurntaljdisohawpqf.supabase.co";
const EXTERNAL_SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhyeXVybnRhbGpkaXNvaGF3cHFmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NzA4ODczOSwiZXhwIjoyMDYyNjY0NzM5fQ.RWpwN7FYh5vbkKFnRw6p-QGU63z-bhQ7Kp843vYR6pQ";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const participantPhone = body?.participantPhone;
    const groupPhone = body?.phone;

    if (!participantPhone || !groupPhone) {
      return new Response(JSON.stringify({ 
        error: "Telefones não encontrados",
        details: "participantPhone e phone são obrigatórios" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    console.log("🔐 Iniciando fluxo de senha para:", participantPhone);

    // Load Z-API configuration
    const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();

    if (!instanceId || !instanceToken || !clientToken) {
      return new Response(JSON.stringify({ 
        error: "Configuração Z-API incompleta" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    // Initialize external Supabase client
    const externalSupabase = createClient(EXTERNAL_SUPABASE_URL, EXTERNAL_SUPABASE_KEY);
    
    // Initialize current project Supabase client
    const currentSupabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Step 1: Search for existing user in franchising_owners table
    console.log("🔍 Buscando usuário na tabela franchising_owners...");
    console.log("📞 Telefone para busca:", participantPhone);
    
    const { data: existingUser, error: searchError } = await externalSupabase
      .from('franchising_owners')
      .select('*')
      .eq('phone', participantPhone)
      .maybeSingle();
    
    console.log("🔍 Resultado da busca:", { existingUser, searchError });

    let userPassword = null;

    if (existingUser && existingUser.web_password) {
      // User exists and has password
      userPassword = existingUser.web_password;
      console.log("✅ Usuário encontrado com senha existente");
    } else {
      // User doesn't exist or doesn't have password - need to create/update
      console.log("🆕 Usuário não encontrado ou sem senha, criando nova...");
      
      // Step 2: Get unit code to generate password
      const { data: unidadeData, error: unidadeError } = await currentSupabase
        .from('unidades')
        .select('codigo_grupo')
        .eq('id_grupo_branco', groupPhone)
        .single();

      let codigoGrupo = null;
      
      if (unidadeData?.codigo_grupo) {
        codigoGrupo = unidadeData.codigo_grupo;
      } else {
        // Try alternative search by grupo
        const { data: unidadeAlternativa } = await currentSupabase
          .from('unidades')
          .select('codigo_grupo')
          .eq('grupo', groupPhone)
          .single();
        
        codigoGrupo = unidadeAlternativa?.codigo_grupo;
      }

      if (!codigoGrupo) {
        console.log("⚠️ Código do grupo não encontrado, usando padrão");
        codigoGrupo = "0001"; // Default code
      }

      // Step 3: Generate password (intercalate random + unit code)
      const codigo = String(codigoGrupo).padStart(4, "0");
      const random = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
      
      let senha = "";
      for (let i = 0; i < 4; i++) {
        senha += random[i] + codigo[i];
      }

      userPassword = senha;

      // Step 4: Check if password already exists to avoid duplicates
      const { data: existingPassword } = await externalSupabase
        .from('franchising_owners')
        .select('web_password')
        .eq('web_password', senha)
        .single();

      if (existingPassword) {
        // Regenerate if password exists
        const newRandom = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
        senha = "";
        for (let i = 0; i < 4; i++) {
          senha += newRandom[i] + codigo[i];
        }
        userPassword = senha;
      }

      // Step 5: Create or update user record
      if (existingUser) {
        // Update existing user with new password
        const { error: updateError } = await externalSupabase
          .from('franchising_owners')
          .update({ web_password: userPassword })
          .eq('phone', participantPhone);

        if (updateError) {
          console.error("❌ Erro ao atualizar senha:", updateError);
        } else {
          console.log("✅ Senha atualizada para usuário existente");
        }
      } else {
        // Create new user
        const { error: createError } = await externalSupabase
          .from('franchising_owners')
          .insert({
            phone: participantPhone,
            web_password: userPassword,
            Id: userPassword
          });

        if (createError) {
          console.error("❌ Erro ao criar usuário:", createError);
        } else {
          console.log("✅ Novo usuário criado com senha");
        }
      }
    }

    // Step 6: Send password privately to participant
    console.log("📱 Enviando senha no PV...");
    
    const privateMessageUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-button-otp`;
    const privatePayload = {
      phone: participantPhone,
      message: `👋 GiraBot por aqui!\n\nAqui está sua senha de acesso:\n\n🗝️ *${userPassword}*\n\nUse o botão abaixo para copiar facilmente. Não compartilhe com ninguém. 😉`,
      code: userPassword,
      image: "https://liovmltalaicwrixigjb.supabase.co/storage/v1/object/public/imagens_girabot/CAPA%20GIRABOT%20COM%20FUNDO.png",
      buttonText: "Copiar Senha"
    };

    const privateRes = await fetch(privateMessageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(privatePayload),
    });

    console.log("📤 Senha enviada no PV:", privateRes.status);

    // Step 7: Send confirmation message in group
    console.log("📢 Enviando confirmação no grupo...");
    
    const groupMessageUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
    const groupPayload = {
      phone: groupPhone,
      message: "🔐 Sua senha foi enviada no seu WhatsApp!\nCopie e cole diretamente para acessar o GiraBot. 😉"
    };

    const groupRes = await fetch(groupMessageUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(groupPayload),
    });

    console.log("📤 Confirmação enviada no grupo:", groupRes.status);

    return new Response(JSON.stringify({ 
      success: true, 
      step: "password_sent",
      password_created: !existingUser || !existingUser.web_password
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });

  } catch (err) {
    console.error("❌ Erro no fluxo de senha:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      }
    );
  }
});