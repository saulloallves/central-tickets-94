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
    const phone = body?.phone || body?.participantPhone;

    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    console.log("📲 Iniciando AUTOATENDIMENTO para:", phone);

    // Monta menu de autoatendimento (igual ao n8n)
    const menuBody = {
      phone,
      message: "⚡ *Menu de Autoatendimento*\n\n😊 Selecione uma das opções abaixo pra continuar:",
      buttonList: {
        buttons: [
          { id: "autoatendimento_calendario", label: "📆 Calendário Anual" },
          { id: "autoatendimento_midias", label: "🖼️ Acessar Mídias" },
          { id: "autoatendimento_ticket", label: "🎫 Fazer uma solicitação (Ticket)" },
          { id: "autoatendimento_dfcom", label: "🖥️ Falar com DFCom" },
          { id: "autoatendimento_nao_sei_senha", label: "🗝️ Senha Girabot" },
          { id: "autoatendimento_ouvidoria", label: "📢 Ouvidoria" },
          { id: "autoatendimento_manuais", label: "📚 Manuais de Franquia" },
          { id: "outras_opcoes", label: "🤖 Acessar GiraBot" },
        ],
      },
    };

    // Envia via Z-API
    const res = await fetch(`${Deno.env.get("ZAPI_INSTANCE_URL")}/send-button-list`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": Deno.env.get("ZAPI_TOKEN") || "",
      },
      body: JSON.stringify(menuBody),
    });

    console.log("📤 Menu Autoatendimento enviado:", res.status);

    return new Response(JSON.stringify({ success: true, step: "menu_autoatendimento" }), {
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