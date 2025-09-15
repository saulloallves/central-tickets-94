import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📩 Webhook acompanhar_chamado recebido:", body);

    // Extrai o phone do grupo
    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado no payload" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    // Conecta no Supabase atual (para chamados)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // Conecta no Supabase externo (para unidades)
    const externalSupabase = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL"),
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY"),
    );

    // 1. Busca a unidade correspondente ao grupo no projeto externo
    const { data: unidade, error: unidadeError } = await externalSupabase
      .from("unidades")
      .select("id, grupo, codigo_grupo, concierge_name, concierge_phone")
      .eq("id_grupo_branco", phone)
      .maybeSingle();

    if (unidadeError || !unidade) {
      console.error("❌ Unidade não encontrada:", unidadeError);
      
      // Configurações Z-API
      const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
      const instanceToken = Deno.env.get("ZAPI_TOKEN");
      const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN");
      const baseUrl = Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";
      const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}`;

      async function enviarZapi(endpoint: string, payload: any) {
        try {
          const res = await fetch(`${zapiUrl}/${endpoint}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Client-Token": clientToken },
            body: JSON.stringify(payload),
          });
          const data = await res.json();
          console.log("📤 Enviado:", endpoint, data);
        } catch (err) {
          console.error("❌ Erro ao enviar Z-API:", err);
        }
      }

      await enviarZapi("send-text", {
        phone,
        message: "❌ *Unidade não encontrada*\n\nNão foi possível localizar informações desta unidade no sistema.",
      });

      return new Response(JSON.stringify({ error: "Unidade não encontrada" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }
    console.log("✅ Unidade encontrada:", unidade);

    // 2. Buscar chamado ativo do telefone/grupo
    const { data: chamadoAtivo, error: chamadoError } = await supabase
      .from("chamados")
      .select("id, status, criado_em, tipo_atendimento, categoria, descricao")
      .eq("telefone", phone)
      .eq("unidade_id", unidade.id)
      .in("status", ["em_fila", "em_atendimento"])
      .order("criado_em", { ascending: false })
      .maybeSingle();

    if (chamadoError) {
      console.error("❌ Erro ao buscar chamado:", chamadoError);
      return new Response(JSON.stringify({ error: "Erro ao buscar chamado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    // Configurações Z-API
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN");
    const baseUrl = Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";
    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}`;

    async function enviarZapi(endpoint: string, payload: any) {
      try {
        const res = await fetch(`${zapiUrl}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": clientToken },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log("📤 Enviado:", endpoint, data);
      } catch (err) {
        console.error("❌ Erro ao enviar Z-API:", err);
      }
    }

    if (!chamadoAtivo) {
      // Não há atendimento em andamento
      await enviarZapi("send-button-list", {
        phone,
        message: "📋 *Acompanhar Chamado*\n\nVocê não possui nenhum atendimento personalizado em andamento no momento.\n\nDeseja iniciar um novo atendimento?",
        buttonList: {
          buttons: [
            { id: "concierge_falar", label: "🔵 Iniciar Atendimento" },
            { id: "autoatendimento_menu", label: "🔄 Autoatendimento" },
          ],
        },
      });

      return new Response(JSON.stringify({ 
        success: true, 
        tem_atendimento: false 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    // Há atendimento ativo - calcular informações
    const agora = new Date();
    const criadoEm = new Date(chamadoAtivo.criado_em);
    const tempoEspera = Math.floor((agora.getTime() - criadoEm.getTime()) / (1000 * 60)); // em minutos

    let mensagem = `📊 *Status do seu Atendimento*\n\n`;
    mensagem += `🕐 *Aberto em:* ${criadoEm.toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n`;
    mensagem += `⏱️ *Tempo decorrido:* ${tempoEspera} minutos\n`;
    mensagem += `📋 *Tipo:* ${chamadoAtivo.tipo_atendimento}\n`;

    if (chamadoAtivo.status === "em_fila") {
      // Calcular posição na fila
      const { data: fila, error: filaError } = await supabase
        .from("chamados")
        .select("id, criado_em")
        .eq("status", "em_fila")
        .eq("unidade_id", unidade.id)
        .order("criado_em", { ascending: true });

      if (!filaError && fila) {
        const posicao = fila.findIndex((c) => c.id === chamadoAtivo.id) + 1;
        mensagem += `🎯 *Posição na fila:* #${posicao}\n`;
        mensagem += `👥 *Total na fila:* ${fila.length} atendimentos\n`;
      }

      mensagem += `\n⏳ *Status:* Aguardando atendimento\n`;
      mensagem += `\nVocê receberá uma mensagem assim que for sua vez.`;
    } else if (chamadoAtivo.status === "em_atendimento") {
      mensagem += `\n👥 *Status:* Em atendimento\n`;
      mensagem += `\nVocê está sendo atendido agora por nossa equipe.`;
    }

    await enviarZapi("send-button-list", {
      phone,
      message: mensagem,
      buttonList: {
        buttons: [
          { id: "personalizado_finalizar", label: "✅ Finalizar atendimento" },
          { id: "autoatendimento_menu", label: "🔄 Transferir para autoatendimento" },
        ],
      },
    });

    return new Response(JSON.stringify({ 
      success: true, 
      tem_atendimento: true,
      chamado: chamadoAtivo,
      tempo_espera: tempoEspera
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });

  } catch (err) {
    console.error("❌ Erro interno:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }
});