import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    console.log("🖼️ AUTOATENDIMENTO_MIDIAS - INICIADO -", new Date().toISOString());
    const body = await req.json();

    // Verificar modo silencioso (para integração com Typebot)
    const silentMode = body?.silent_mode === true;
    console.log(`🔇 Silent Mode: ${silentMode}`);

    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    if (!phone) return new Response(JSON.stringify({ error: "Telefone não encontrado" }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 });

    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN");
    const baseUrl = Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";
    if (!instanceId || !instanceToken || !clientToken) {
      return new Response(JSON.stringify({ error: "Configuração Z-API incompleta", details: "ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN são obrigatórios" }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 });
    }

    const payload = {
      phone,
      message: "🖼️ *Acessar Mídias*\n\n🟡 Todas as mídias estão disponíveis diretamente no *GiraBot.*\n\n⬇️ _*Clique no link abaixo para acessar o GiraBot*_\n",
      image: "https://hryurntaljdisohawpqf.supabase.co/storage/v1/object/public/figurinhascresci/midias_girabot/CAPA%20GIRABOT%20COM%20FUNDO.png",
      linkUrl: "https://fluxoapi.contatocrescieperdi.com.br/menu-midias",
      title: "🖼️ Acessar Mídias",
      linkDescription: "🟡 Todas as mídias estão disponíveis diretamente no GiraBot."
    };

    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-link`;
    
    if (!silentMode) {
      const res = await fetch(zapiUrl, { method: "POST", headers: { "Content-Type": "application/json", "Client-Token": clientToken }, body: JSON.stringify(payload) });
      return new Response(await res.text(), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: res.status });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      mensagem_gerada: payload.message 
    }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 });
  } catch (err) {
    console.error("❌ Erro no autoatendimento_midias:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: err.message }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 });
  }
});