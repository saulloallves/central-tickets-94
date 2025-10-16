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
    console.log("🗝️ AUTOATENDIMENTO_NAO_SEI_SENHA - Recebendo requisição");
    const body = await req.json();
    console.log("📦 Body parseado:", JSON.stringify(body, null, 2));
    
    // Verificar modo silencioso (para integração com Typebot)
    const silentMode = body?.silent_mode === true;
    console.log(`🔇 Silent Mode: ${silentMode}`);
    
    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    console.log("📞 Telefone extraído:", phone);

    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

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

    const payload = {
      phone,
      message: "🗝️ *Senha GiraBot*\n\nPara recuperar sua senha do GiraBot, acesse:\n\n🔗 https://crescieperdi.com.br/recuperar-senha\n\nOu entre em contato conosco pelo WhatsApp: (11) 99999-9999",
    };

    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
    console.log(`📤 Enviando senha info para Z-API: ${zapiUrl.replace(instanceToken, '****')}`);

    if (!silentMode) {
      const res = await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("📤 Senha info enviado:", data);

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: res.status,
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      mensagem_gerada: payload.message 
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro no autoatendimento_nao_sei_senha:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});