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
    console.log("🧪 TEST-WEBHOOK: Recebendo requisição");
    const body = await req.json();
    console.log("🧪 TEST-WEBHOOK: Body recebido:", JSON.stringify(body, null, 2));

    const buttonId = body?.buttonsResponseMessage?.buttonId || "";
    console.log("🧪 TEST-WEBHOOK: ButtonId extraído:", buttonId);

    if (buttonId === "autoatendimento_midias") {
      console.log("🧪 TEST-WEBHOOK: MATCH com autoatendimento_midias!");
      
      // Configurações Z-API
      const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
      const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN") || Deno.env.get("ZAPI_TOKEN");
      const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN");
      const baseUrl = Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";

      console.log("🧪 TEST-WEBHOOK: Configurações Z-API:", { instanceId: !!instanceId, instanceToken: !!instanceToken, clientToken: !!clientToken });

      if (!instanceId || !instanceToken || !clientToken) {
        console.log("🧪 TEST-WEBHOOK: ERRO - Configurações Z-API faltando");
        return new Response(JSON.stringify({ 
          error: "Configuração Z-API incompleta", 
          details: "ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN são obrigatórios" 
        }), {
          headers: { "Content-Type": "application/json", ...corsHeaders },
          status: 500,
        });
      }

      const phone = body?.body?.phone || body?.phone || body?.participantPhone;
      console.log("🧪 TEST-WEBHOOK: Telefone extraído:", phone);

      const payload = {
        phone,
        message: "🧪 TESTE: Webhook funcionando! Clique em 'Acessar Mídias' foi detectado corretamente.",
      };

      const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
      console.log("🧪 TEST-WEBHOOK: Enviando para Z-API:", zapiUrl.replace(instanceToken, '****'));

      const res = await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
        body: JSON.stringify(payload),
      });

      console.log("🧪 TEST-WEBHOOK: Resposta Z-API:", res.status);
      const data = await res.json();
      console.log("🧪 TEST-WEBHOOK: Data:", data);

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: res.status,
      });
    }

    console.log("🧪 TEST-WEBHOOK: ButtonId não reconhecido:", buttonId);
    return new Response(JSON.stringify({ success: true, message: "Test webhook funcionando", buttonId }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });

  } catch (err) {
    console.error("🧪 TEST-WEBHOOK: ERRO:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});