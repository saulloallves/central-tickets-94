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
    console.log("🚀 BOT_BASE_1 INICIADO - Recebendo requisição");
    const body = await req.json();
    console.log("📦 Body parseado:", JSON.stringify(body, null, 2));

    // Tenta extrair buttonId de várias formas possíveis
    const buttonId1 = body?.buttonsResponseMessage?.buttonId;
    const buttonId2 = body?.buttonId;
    const buttonId3 = body?.button?.id;
    const buttonId4 = body?.selectedButtonId;
    
    const buttonId = buttonId1 || buttonId2 || buttonId3 || buttonId4 || "";
    
    // Extrai phone e message 
    const phone = body?.phone || body?.participantPhone;
    const message = (body?.text?.message || body?.message || "").toLowerCase();

    console.log("🔍 DADOS EXTRAÍDOS:");
    console.log("Phone:", phone);
    console.log("ButtonId:", buttonId);
    console.log("Message:", message);

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

    // 🔹 AUTOATENDIMENTO (Menu principal)
    if (buttonId === "autoatendimento_menu") {
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
    
    // Calendário
    if (buttonId === "autoatendimento_calendario") {
      return await proxy(functionsBaseUrl, "autoatendimento_calendario", body);
    }
    if (buttonId === "autoatendimento_midias") {
      console.log("🖼️ MATCH! REDIRECIONANDO PARA autoatendimento_midias");
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
    if (buttonId === "ticket_equipes") {
      return await proxy(functionsBaseUrl, "ticket_equipes", body);
    }
    if (buttonId === "personalizado_menu") {
      return await proxy(functionsBaseUrl, "personalizado_menu", body);
    }
    if (buttonId === "suporte_dfcom") {
      return await proxy(functionsBaseUrl, "suporte_dfcom", body);
    }
    if (buttonId === "falar_com_concierge") {
      return await proxy(functionsBaseUrl, "concierge_falar", body);
    }
    if (buttonId === "emergencia_menu") {
      return await proxy(functionsBaseUrl, "emergencia_menu", body);
    }

    // 🔹 VOLTAR AO MENU INICIAL
    if (buttonId === "voltar_menu_inicial") {
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

    // ❌ Pula DFCom por enquanto
    if (buttonId === "autoatendimento_dfcom") {
      console.log("🚫 DFCom desativado por enquanto");
      return new Response(
        JSON.stringify({ success: false, message: "DFCom ainda não implementado" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
      );
    }

    // Caso não reconheça
    console.log("⏭️ NENHUMA CONDIÇÃO ATENDIDA - ButtonId:", buttonId, "Message:", message);
    console.log("⏭️ Ignorando requisição");
    return new Response(JSON.stringify({ success: true, ignored: true, buttonId, message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro no bot_base_1:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});

// 🔧 Função helper para redirecionar chamadas
async function proxy(baseUrl: string, functionName: string, body: any) {
  try {
    console.log(`🔄 Redirecionando para ${functionName}`);
    const res = await fetch(`${baseUrl}/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();
    console.log(`📤 Resposta de ${functionName}:`, res.status, responseText.substring(0, 200));

    return new Response(responseText, {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: res.status,
    });
  } catch (error) {
    console.error(`❌ Erro no proxy para ${functionName}:`, error);
    return new Response(
      JSON.stringify({ error: `Erro no proxy para ${functionName}`, details: error.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
}