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
    
    // Extrai dados básicos
    const buttonId = body?.buttonsResponseMessage?.buttonId || body?.buttonId || "";
    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    
    // SEMPRE ENVIA UMA RESPOSTA PARA QUALQUER WEBHOOK
    if (phone) {
      const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
      const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN") || Deno.env.get("ZAPI_TOKEN");
      const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN");
      const baseUrl = Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";

      if (instanceId && instanceToken && clientToken) {
        const testMessage = `🧪 WEBHOOK RECEBIDO!
ButtonId: "${buttonId}"
Timestamp: ${new Date().toISOString()}`;

        const payload = { phone, message: testMessage };

        await fetch(`${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken,
          },
          body: JSON.stringify(payload),
        });
      }
    }

    return new Response(JSON.stringify({ success: true, buttonId, phone }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }
});