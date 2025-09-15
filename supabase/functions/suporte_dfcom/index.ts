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
    console.log("⚫ SUPORTE_DFCOM - INICIADO -", new Date().toISOString());
    const body = await req.json();
    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    // Configurações Z-API
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN");
    const baseUrl = Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";

    if (!instanceId || !instanceToken || !clientToken) {
      return new Response(JSON.stringify({ 
        error: "Configuração Z-API incompleta", 
        details: "ZAPI_INSTANCE_ID, ZAPI_INSTANCE_TOKEN e ZAPI_CLIENT_TOKEN são obrigatórios" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    const payload = {
      phone,
      message: "⚫ *Suporte Imediato - DFCom*\n\n🚀 Para suporte técnico imediato com nossa equipe DFCom, você será direcionado para atendimento especializado.\n\n📞 Nossa equipe está pronta para resolver questões técnicas urgentes.\n\n👇 Selecione uma das opções abaixo:",
      image: "https://hryurntaljdisohawpqf.supabase.co/storage/v1/object/public/figurinhascresci/midias_girabot/CAPA%20GIRABOT%20COM%20FUNDO.png",
      buttonList: {
        buttons: [
          { id: "falar_com_dfcom", label: "🛠️ Falar com DFCom" },
          { id: "finalizar_atendimento_dfcom", label: "📱 Finalizar Atendimento" },
          { id: "transferir_autoatendimento", label: "🔄 Transferir para Autoatendimento" },
          { id: "voltar_menu_inicial", label: "↩️ Voltar ao Menu Inicial" }
        ]
      }
    };

    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-button-list`;
    console.log(`📤 Enviando suporte_dfcom para Z-API: ${zapiUrl.replace(instanceToken, '****')}`);

    const res = await fetch(zapiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken,
      },
      body: JSON.stringify(payload),
    });

    console.log(`📊 Z-API Response Status: ${res.status} ${res.statusText}`);
    
    let data;
    const responseText = await res.text();
    
    if (responseText.trim()) {
      try {
        data = JSON.parse(responseText);
        console.log("📤 Suporte DFCom enviado:", data);
      } catch (parseError) {
        console.error("❌ Erro ao fazer parse da resposta Z-API:", parseError);
        console.log("📜 Resposta Z-API raw:", responseText);
        data = { 
          success: false, 
          error: "Resposta inválida da Z-API",
          rawResponse: responseText
        };
      }
    } else {
      console.log("⚠️ Resposta Z-API vazia");
      data = { 
        success: res.ok, 
        message: res.ok ? "Mensagem enviada" : "Erro na Z-API",
        status: res.status
      };
    }

    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: res.status,
    });
  } catch (err) {
    console.error("❌ Erro no suporte_dfcom:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});