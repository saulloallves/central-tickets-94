import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    const buttonId = body?.buttonsResponseMessage?.buttonId || "";
    const message = (body?.text?.message || "").toLowerCase().trim();

    console.log("📩 Mensagem recebida:", { buttonId, message, body });

    // Lista de palavras-chave
    const KEYWORDS = ["ola robo", "olá robô", "abacate"];

    // Se clicar em botão ou digitar palavra-chave
    if (
      buttonId.startsWith("autoatendimento") ||
      KEYWORDS.some((k) => message.includes(k))
    ) {
      console.log("➡️ Redirecionando para fluxo AUTOATENDIMENTO");

      const functionsBaseUrl = Deno.env.get("FUNCTIONS_BASE_URL") || 
        `https://hryurntaljdisohawpqf.supabase.co/functions/v1`;

      const res = await fetch(
        `${functionsBaseUrl}/autoatendimento`,
        {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify(body),
        }
      );

      const responseData = await res.text();
      console.log("📤 Resposta do autoatendimento:", responseData);

      return new Response(responseData, {
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: res.status,
      });
    }

    // Caso não caia em nenhum filtro
    console.log("⏭️ Mensagem ignorada - não atende aos filtros");
    return new Response(JSON.stringify({ success: true, message: "Ignorado" }), {
      headers: { 
        "Content-Type": "application/json",
        ...corsHeaders 
      },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro no bot_base:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }), 
      { 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders 
        },
        status: 500 
      }
    );
  }
});