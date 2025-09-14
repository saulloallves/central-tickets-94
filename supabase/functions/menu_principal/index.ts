import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const phone = body?.phone || body?.participantPhone;

    console.log("📱 Enviando menu principal para:", phone);

    const menuBody = {
      phone,
      message: "🤖 *Olá! Sou o GiraBot da Cresci e Perdi!*\n\nEscolha uma das opções abaixo:",
      buttonList: {
        buttons: [
          {
            id: "autoatendimento_menu",
            text: "🔧 Autoatendimento"
          },
          {
            id: "outras_opcoes",
            text: "🔗 Outras Opções"
          }
        ]
      }
    };

    const response = await fetch(`${Deno.env.get("ZAPI_INSTANCE_URL")}/send-button-list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": Deno.env.get("ZAPI_TOKEN") || "",
      },
      body: JSON.stringify(menuBody),
    });

    console.log("📤 Status do envio do menu:", response.status);

    return new Response(JSON.stringify({ success: true, step: "menu_principal" }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro no menu_principal:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }
});