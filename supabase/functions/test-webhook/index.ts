import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

console.log("🧪 TEST-WEBHOOK: Função carregada!");

serve(async (req: Request) => {
  console.log("🧪 TEST-WEBHOOK: Requisição recebida!");
  
  if (req.method === "OPTIONS") {
    console.log("🧪 TEST-WEBHOOK: OPTIONS request");
    return new Response(null, { 
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      }
    });
  }

  try {
    console.log("🧪 TEST-WEBHOOK: Tentando parsear body...");
    const body = await req.json();
    console.log("🧪 TEST-WEBHOOK: Body parseado com sucesso!");
    
    const buttonId = body?.buttonsResponseMessage?.buttonId || "";
    console.log("🧪 TEST-WEBHOOK: ButtonId encontrado:", buttonId);

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Test webhook funcionando!", 
      buttonId: buttonId,
      timestamp: new Date().toISOString()
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 200,
    });

  } catch (err) {
    console.log("🧪 TEST-WEBHOOK: ERRO capturado:", err.message);
    return new Response(JSON.stringify({ 
      error: "Erro capturado", 
      details: err.message 
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      status: 500,
    });
  }
});