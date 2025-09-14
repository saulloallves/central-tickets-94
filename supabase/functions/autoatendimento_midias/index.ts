import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("🖼️ AUTOATENDIMENTO_MIDIAS - INICIADO - Timestamp:", new Date().toISOString());
    const body = await req.json();
    console.log("📦 Body recebido:", JSON.stringify(body, null, 2));

    // Identifica telefone (grupo ou individual)
    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    if (!phone) {
      console.error("❌ Telefone não encontrado no body:", body);
      return new Response(
        JSON.stringify({ error: "Telefone não encontrado" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
      );
    }

    // Configurações Z-API
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_TOKEN"); // Token da instância (usado na URL)
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN");     // Token do cliente (usado no header)
    const baseUrl = Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";

    if (!instanceId || !instanceToken || !clientToken) {
      console.error("❌ Configuração Z-API incompleta:", { instanceId: !!instanceId, instanceToken: !!instanceToken, clientToken: !!clientToken });
      return new Response(JSON.stringify({ 
        error: "Configuração Z-API incompleta", 
        details: "ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN são obrigatórios" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    console.log("✅ Configurações Z-API:", { 
      instanceId, 
      baseUrl, 
      hasInstanceToken: !!instanceToken, 
      hasClientToken: !!clientToken,
      instanceTokenLength: instanceToken?.length,
      clientTokenLength: clientToken?.length
    });

    // Payload conforme seu fluxo original no n8n
    const payload = {
      phone,
      message: "🖼️ *Acessar Mídias*\n\n🟡 Todas as mídias estão disponíveis diretamente no *GiraBot.*\n\n⬇️ _*Clique no link abaixo para acessar o GiraBot*_",
      image: "https://hryurntaljdisohawpqf.supabase.co/storage/v1/object/public/figurinhascresci/midias_girabot/CAPA%20GIRABOT%20COM%20FUNDO.png",
      linkUrl: "https://fluxoapi.contatocrescieperdi.com.br/menu-midias",
      title: "🖼️ Acessar Mídias",
      linkDescription: "🟡 Todas as mídias estão disponíveis diretamente no GiraBot."
    };

    console.log("📩 Enviando payload autoatendimento_midias:", payload);

    // Constrói URL correta da Z-API para send-link
    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-link`;
    console.log(`📤 Enviando para Z-API: ${zapiUrl.replace(instanceToken, '****')}`);

    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("📤 Resposta da Z-API (midias):", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: res.status
    });

  } catch (err) {
    console.error("❌ Erro no autoatendimento_midias:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});