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
    const body = await req.json();

    // Identifica telefone (grupo ou individual)
    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    if (!phone) {
      console.error("❌ Telefone não encontrado no body:", body);
      return new Response(
        JSON.stringify({ error: "Telefone não encontrado" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 }
      );
    }

    const urlZApi = Deno.env.get("ZAPI_INSTANCE_URL");
    const clientToken = Deno.env.get("ZAPI_TOKEN");

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

    const res = await fetch(`${urlZApi}/send-link`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken || ""
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