import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json();
    const phone = body?.phone || body?.participantPhone;

    const payload = {
      phone,
      message: "🎫 Seu ticket foi registrado! Nossa equipe entrará em contato em breve.",
    };

    await fetch(`${Deno.env.get("ZAPI_INSTANCE_URL")}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": Deno.env.get("ZAPI_TOKEN") || "" },
      body: JSON.stringify(payload),
    });

    return new Response(JSON.stringify({ success: true, step: "ticket" }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 });
  }
});