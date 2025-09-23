import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    console.log("📚 AUTOATENDIMENTO_MANUAIS - INICIADO -", new Date().toISOString());
    const body = await req.json();
    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    if (!phone) return new Response(JSON.stringify({ error: "Telefone não encontrado" }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 400 });

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

    const payload = {
      phone,
      message: "🟡 Aqui você acessa os documentos que orientam, padronizam e fiscalizam tudo o que acontece nas unidades Cresci e Perdi. Acesse no *GiraBot.*\n\n⬇️ _*Clique no link abaixo para acessar o GiraBot*_\n",
      image: "https://hryurntaljdisohawpqf.supabase.co/storage/v1/object/public/figurinhascresci/midias_girabot/CAPA%20GIRABOT%20COM%20FUNDO.png",
      linkUrl: "https://fluxoapi.contatocrescieperdi.com.br/menu-governanca",
      title: "📚 Acessar Manuais",
      linkDescription: "🟡 Aqui você acessa os documentos que orientam, padronizam e fiscalizam tudo o que acontece nas unidades Cresci e Perdi."
    };

    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-link`;
    const res = await fetch(zapiUrl, { method: "POST", headers: { "Content-Type": "application/json", "Client-Token": clientToken }, body: JSON.stringify(payload) });
    return new Response(await res.text(), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: res.status });
  } catch (err) {
    console.error("❌ Erro no autoatendimento_manuais:", err);
    return new Response(JSON.stringify({ error: "Erro interno", details: err.message }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 });
  }
});