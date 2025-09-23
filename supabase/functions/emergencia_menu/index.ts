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

    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
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
        details: "BOT_ZAPI_INSTANCE_ID, BOT_ZAPI_TOKEN e BOT_ZAPI_CLIENT_TOKEN são obrigatórios" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    // Mensagem de emergência
    const payload = {
      phone,
      message: "🚨 *ATENDIMENTO DE EMERGÊNCIA*\n\n⚠️ Situação identificada como emergencial!\n\nVocê será conectado IMEDIATAMENTE com nossa equipe de suporte prioritário.\n\n📞 Se precisar de ajuda urgente, ligue também para: **(11) 99999-9999**\n\nAguarde, já estamos te direcionando...",
    };

    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
    console.log(`🚨 Enviando atendimento de emergência para Z-API: ${zapiUrl.replace(instanceToken, '****')}`);

    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("🚨 Atendimento de emergência enviado:", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: res.status,
    });
  } catch (err) {
    console.error("❌ Erro no emergencia_menu:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});