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
    console.log("🖼️ AUTOATENDIMENTO_MIDIAS - Recebendo requisição");
    const body = await req.json();
    console.log("📦 Body parseado:", JSON.stringify(body, null, 2));
    
    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    console.log("📞 Telefone extraído:", phone);

    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    // Verificar se é um grupo (contém -group) e extrair o número correto
    let cleanPhone = phone;
    if (phone.includes('-group')) {
      console.log("📱 Detectado grupo WhatsApp, ignorando envio para grupo");
      return new Response(JSON.stringify({ success: false, message: "Não enviamos mensagens para grupos" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    console.log("📞 Telefone limpo:", cleanPhone);

    // Configurações Z-API
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_INSTANCE_TOKEN") || Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN");
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

    console.log("✅ Configurações Z-API:", { instanceId, baseUrl, hasToken: !!instanceToken, hasClientToken: !!clientToken });

    const payload = {
      phone: cleanPhone,
      message: "🖼️ *Acessar Mídias Oficiais*\n\nTodos os materiais de comunicação, logos e mídias oficiais estão disponíveis em:\n\n🔗 https://crescieperdi.com.br/midias\n\n📱 Você encontrará:\n• Logos em alta resolução\n• Posts para redes sociais\n• Banners e materiais gráficos\n• Vídeos institucionais",
    };

    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
    console.log(`📤 Enviando midias info para Z-API: ${zapiUrl.replace(instanceToken, '****')}`);

    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    console.log("📤 Resposta Z-API:", data);

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: res.status,
    });
  } catch (err) {
    console.error("❌ Erro no autoatendimento_midias:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});