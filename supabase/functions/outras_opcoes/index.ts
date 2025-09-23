import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const phone = body?.phone || body?.participantPhone;

    const payload = {
      phone,
      message: "🤖 Voltando para o GiraBot principal! Digite novamente *olá robô* para recomeçar.",
    };

    // Carrega configurações Z-API
    const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();

    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-link`;

    const linkPayload = {
      phone,
      message: "🤖 Aqui está o link para o *GiraBot*:\n\nAcesse quando quiser fazer solicitações, consultar mídias, falar com a DFCom ou abrir tickets.\n\n⬇️ _*Clique no link abaixo para acessar o GiraBot*_\n",
      image: "https://hryurntaljdisohawpqf.supabase.co/storage/v1/object/public/figurinhascresci/midias_girabot/CAPA%20GIRABOT%20COM%20FUNDO.png",
      linkUrl: "https://girabot.com",
      title: "🔗 Acessar GiraBot",
      linkDescription: "Acesse quando quiser fazer solicitações, consultar mídias, falar com a DFCom ou abrir tickets."
    };

    await fetch(zapiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": clientToken },
      body: JSON.stringify(linkPayload),
    });

    return new Response(JSON.stringify({ success: true, step: "outras_opcoes" }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 });
  }
});