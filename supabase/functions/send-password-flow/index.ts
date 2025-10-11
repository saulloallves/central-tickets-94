import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to normalize phone numbers
function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('55')) {
    return cleaned;
  }
  if (cleaned.length >= 10) {
    return `55${cleaned}`;
  }
  return cleaned;
}

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

    // Initialize current project Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Normalize phone number for search
    const normalizedPhone = normalizePhone(participantPhone);
    console.log("📞 Telefone normalizado:", normalizedPhone);

    // Remove "55" prefix to match database format (phone column doesn't have 55)
    let searchPhone = normalizedPhone;
    if (searchPhone.startsWith('55')) {
      searchPhone = searchPhone.substring(2);
    }

    console.log("🔍 Buscando franqueado:", {
      phone_original: participantPhone,
      phone_normalizado: normalizedPhone,
      phone_busca: searchPhone
    });

    // Step 1: Search for franchisee in franqueados table using phone column
    const { data: franqueado, error: searchError } = await supabase
      .from('franqueados')
      .select('id, phone, normalized_phone, web_password, name, email')
      .eq('phone', searchPhone)
      .maybeSingle();
    
    console.log("🔍 Resultado da busca:", { 
      found: !!franqueado, 
      hasPassword: !!franqueado?.web_password,
      error: searchError 
    });

    // Step 2: Handle different scenarios
    if (!franqueado) {
      // Scenario 3: User not found - send registration message
      console.log("❌ Franqueado não encontrado");
      
      const notFoundMessageUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
      const notFoundPayload = {
        phone: participantPhone,
        message: `📱 Não encontramos um cadastro vinculado a este número de telefone.
Se este número é o seu, você pode fazer seu cadastro agora pelo link abaixo 👇

🔗 cadastro.girabot.com.br

Após o cadastro, você receberá sua senha de acesso.`
      };

      await fetch(notFoundMessageUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
        body: JSON.stringify(notFoundPayload),
      });

      console.log("📤 Mensagem de cadastro enviada");

      return new Response(JSON.stringify({ 
        success: true, 
        user_found: false,
        message_sent: true,
        message_type: "not_registered"
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    if (!franqueado.web_password) {
      // Scenario 2: User found but no password - for now just return status
      console.log("⚠️ Franqueado encontrado mas sem senha cadastrada");
      
      return new Response(JSON.stringify({ 
        success: true, 
        user_found: true,
        password_found: false,
        message: "Franqueado encontrado mas sem senha cadastrada (mensagem pendente)"
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    // Scenario 1: User found with password - send it
    const userPassword = String(franqueado.web_password);
    console.log("✅ Franqueado encontrado com senha");

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
      user_found: true,
      password_found: true,
      password_sent: true
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