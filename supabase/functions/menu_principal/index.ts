import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

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

    const phone = body?.body?.phone || body?.phone;
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    const urlZApi = Deno.env.get("ZAPI_INSTANCE_URL");
    const clientToken = Deno.env.get("ZAPI_TOKEN");

    // Monta o menu principal
    const payload = {
      phone,
      message: "👋 Oi! Eu sou o *GiraBot*, seu assistente automático da *Cresci e Perdi*.\n\nAs opções de atendimento mudaram. Como prefere seguir?",
      buttonList: {
        buttons: [
          { id: "autoatendimento_menu", label: "⚡ Autoatendimento" },
          { id: "personalizado_menu", label: "🤵 Atendimento Personalizado" },
          { id: "emergencia_menu", label: "🚨 Estou em Emergência" },
        ],
      },
    };

    const res = await fetch(`${urlZApi}/send-button-list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("📤 Menu Principal enviado:", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: res.status,
    });
  } catch (err) {
    console.error("❌ Erro no menu_principal:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});