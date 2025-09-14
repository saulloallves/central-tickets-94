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

    const buttonId = body?.buttonsResponseMessage?.buttonId || "";
    const message = (body?.text?.message || "").toLowerCase().trim();

    console.log("📩 Mensagem recebida:", { buttonId, message });

    // Palavras-chave que disparam menu inicial
    const KEYWORDS = ["menu", "ola robo", "olá robô", "abacate"];

    const functionsBaseUrl =
      Deno.env.get("FUNCTIONS_BASE_URL") ||
      `https://hryurntaljdisohawpqf.supabase.co/functions/v1`;

    // 🔹 MENU INICIAL
    if (KEYWORDS.some((k) => message.includes(k))) {
      const res = await fetch(`${functionsBaseUrl}/menu_principal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify(body),
      });
      return new Response(await res.text(), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: res.status,
      });
    }

    // 🔹 AUTOATENDIMENTO
    if (buttonId.startsWith("autoatendimento_menu")) {
      const res = await fetch(`${functionsBaseUrl}/autoatendimento`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify(body),
      });
      return new Response(await res.text(), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: res.status,
      });
    }

    // 🔹 SUBMENUS DO AUTOATENDIMENTO
    if (buttonId === "autoatendimento_calendario") {
      return await proxy(functionsBaseUrl, "autoatendimento_calendario", body);
    }
    if (buttonId === "autoatendimento_midias") {
      return await proxy(functionsBaseUrl, "autoatendimento_midias", body);
    }
    if (buttonId === "autoatendimento_ticket") {
      return await proxy(functionsBaseUrl, "autoatendimento_ticket", body);
    }
    if (buttonId === "autoatendimento_nao_sei_senha") {
      return await proxy(functionsBaseUrl, "autoatendimento_nao_sei_senha", body);
    }
    if (buttonId === "autoatendimento_ouvidoria") {
      return await proxy(functionsBaseUrl, "autoatendimento_ouvidoria", body);
    }
    if (buttonId === "autoatendimento_manuais") {
      return await proxy(functionsBaseUrl, "autoatendimento_manuais", body);
    }
    if (buttonId === "outras_opcoes") {
      return await proxy(functionsBaseUrl, "outras_opcoes", body);
    }

    // 🔹 NOVOS MENUS PRINCIPAIS
    if (buttonId === "personalizado_menu") {
      return await proxy(functionsBaseUrl, "personalizado_menu", body);
    }
    if (buttonId === "emergencia_menu") {
      return await proxy(functionsBaseUrl, "emergencia_menu", body);
    }

    // ❌ Pula DFCom por enquanto
    if (buttonId === "autoatendimento_dfcom") {
      console.log("🚫 DFCom desativado por enquanto");
      return new Response(
        JSON.stringify({ success: false, message: "DFCom ainda não implementado" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
      );
    }

    // Caso não reconheça
    console.log("⏭️ Ignorado");
    return new Response(JSON.stringify({ success: true, ignored: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro no bot_base:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});

// 🔧 Função helper para redirecionar chamadas
async function proxy(baseUrl: string, functionName: string, body: any) {
  const res = await fetch(`${baseUrl}/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
    },
    body: JSON.stringify(body),
  });

  return new Response(await res.text(), {
    headers: { "Content-Type": "application/json", ...corsHeaders },
    status: res.status,
  });
}