import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { loadZAPIConfig } from "../_shared/zapi-config.ts";
import { isBusinessHours } from "../_shared/business-hours.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    // Verificar modo silencioso (para integração com Typebot)
    const silentMode = body?.silent_mode === true;
    console.log(`🔇 Silent Mode: ${silentMode}`);

    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    // Verificar se está dentro do horário de atendimento
    if (!isBusinessHours()) {
      console.log("⏰ Fora do horário de atendimento - redirecionando para autoatendimento");
      
      const mensagemForaHorario = "❌ *Agora estamos fora do horário de atendimento.*\n\n⏰ Nosso time atende de segunda a sábado, das *8h30 às 17h30.*\n\n📝 Você pode abrir um ticket agora mesmo. Sua solicitação será registrada e respondida pela equipe assim que possível.";
      
      if (!silentMode) {
        // Carrega configurações Z-API para enviar mensagem de fora do horário
        const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
        
        const outOfHoursPayload = {
          phone,
          message: mensagemForaHorario,
          buttonList: {
            buttons: [
              {
                id: "autoatendimento_ticket",
                label: "📝 Abrir um ticket agora"
              }
            ]
          }
        };

        const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-button-list`;
        console.log(`📤 Enviando mensagem de fora do horário para Z-API: ${zapiUrl.replace(instanceToken, '****')}`);

        const res = await fetch(zapiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken,
          },
          body: JSON.stringify(outOfHoursPayload),
        });

        const data = await res.json();
        console.log("📤 Mensagem de fora do horário enviada:", data);
      }

      return new Response(JSON.stringify({ 
        success: true, 
        fora_do_horario: true,
        mensagem_gerada: mensagemForaHorario
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    // Carrega configurações Z-API
    const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();

    if (!instanceId || !instanceToken || !clientToken) {
      return new Response(JSON.stringify({ 
        error: "Configuração Z-API incompleta", 
        details: "Z-API credentials são obrigatórios" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    // Menu de atendimento personalizado
    const mensagem = "🔵 *Atendimento Personalizado - Concierge*\n\n😊 Selecione uma das opções abaixo pra continuar:";
    
    if (!silentMode) {
      const payload = {
        phone,
        message: mensagem,
        buttonList: {
          buttons: [
            { id: "falar_com_concierge", label: "🔵 Falar com Concierge" },
            { id: "acompanhar_chamado", label: "📞 Acompanhar Chamado" },
            { id: "voltar_menu_inicial", label: "↩️ Voltar ao Menu Inicial" },
          ],
        },
      };

      const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-button-list`;
      console.log(`📤 Enviando atendimento personalizado para Z-API: ${zapiUrl.replace(instanceToken, '****')}`);

      const res = await fetch(zapiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": clientToken,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      console.log("📤 Atendimento personalizado enviado:", data);
    }

    return new Response(JSON.stringify({ 
      success: true,
      mensagem_gerada: mensagem
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro no personalizado_menu:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});