import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const phone = body?.phone || body?.participantPhone;

    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    console.log("📲 Iniciando AUTOATENDIMENTO para:", phone);

    // Carrega configurações Z-API
    const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();

    if (!instanceId || !instanceToken || !clientToken) {
      return new Response(JSON.stringify({ 
        error: "Configuração Z-API incompleta", 
        details: "Z-API credentials são obrigatórios" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    // Usar a mesma mensagem do outras_opcoes
    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-link`;

    const linkPayload = {
      phone,
      message: "🤖 Aqui está o link para o *GiraBot*:\n\nAcesse quando quiser fazer solicitações, consultar mídias, falar com a DFCom ou abrir tickets.\n\n⬇️ _*Clique no link abaixo para acessar o GiraBot*_\n",
      image: "https://hryurntaljdisohawpqf.supabase.co/storage/v1/object/public/figurinhascresci/midias_girabot/CAPA%20GIRABOT%20COM%20FUNDO.png",
      linkUrl: "https://girabot.com",
      title: "🔗 Acessar GiraBot",
      linkDescription: "Acesse quando quiser fazer solicitações, consultar mídias, falar com a DFCom ou abrir tickets."
    };

    // Envia via Z-API
    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(linkPayload),
    });

    console.log("📤 Menu Autoatendimento enviado:", res.status);

    // Trigger password flow after sending GiraBot link
    console.log("🔐 Iniciando fluxo de envio de senha...");
    
    try {
      const passwordFlowUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/send-password-flow`;
      const passwordFlowPayload = {
        participantPhone: body?.participantPhone,
        phone: phone
      };

      const passwordRes = await fetch(passwordFlowUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
        },
        body: JSON.stringify(passwordFlowPayload),
      });

      console.log("🔐 Fluxo de senha executado:", passwordRes.status);
    } catch (passwordError) {
      console.error("⚠️ Erro no fluxo de senha (não crítico):", passwordError);
      // Don't fail the main flow if password flow fails
    }

    return new Response(JSON.stringify({ success: true, step: "menu_autoatendimento_with_password" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro no autoatendimento:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      }
    );
  }
});