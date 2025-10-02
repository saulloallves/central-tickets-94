// @ts-nocheck
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

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

    // Conecta no Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? '',
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? '',
    );

    // Carrega configurações Z-API
    const config = await loadZAPIConfig();
    
    if (!config.instanceId || !config.instanceToken || !config.clientToken) {
      console.error('❌ Configurações Z-API não encontradas');
      return new Response(JSON.stringify({ error: "Configuração Z-API não encontrada" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    const zapiUrl = `${config.baseUrl}/instances/${config.instanceId}/token/${config.instanceToken}`;

    async function enviarZapi(endpoint: string, payload: any) {
      try {
        const res = await fetch(`${zapiUrl}/${endpoint}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": config.clientToken },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        console.log("📤 Enviado:", endpoint, data);
        return data;
      } catch (err) {
        console.error("❌ Erro ao enviar Z-API:", err);
        return null;
      }
    }

    // 1. Busca a unidade correspondente ao grupo
    const { data: unidade, error: unidadeError } = await supabase
      .from("unidades")
      .select("id, grupo, codigo_grupo")
      .eq("id_grupo_branco", phone)
      .maybeSingle();

    if (unidadeError || !unidade) {
      console.error("❌ Unidade não encontrada:", unidadeError);
      
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

    // 2. Buscar chamados ativos do telefone/grupo
    const { data: chamadoAtivo, error: chamadoError } = await supabase
      .from("chamados")
      .select("id, status, criado_em, categoria, descricao, tipo_atendimento")
      .eq("telefone", phone)
      .eq("unidade_id", unidade.id)
      .in("status", ["em_fila", "em_atendimento", "emergencia"])
      .order("criado_em", { ascending: false })
      .maybeSingle();

    if (chamadoError) {
      console.error("❌ Erro ao buscar chamado:", chamadoError);
      return new Response(JSON.stringify({ error: "Erro ao buscar chamado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    if (!chamadoAtivo) {
      // Não há atendimento em andamento
      await enviarZapi("send-button-list", {
        phone,
        message: "📋 *Acompanhar Chamado*\n\nVocê não possui nenhum atendimento em andamento no momento.\n\nDeseja iniciar um novo atendimento?",
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
    mensagem += `🎫 *Código:* ${chamadoAtivo.id.substring(0, 8)}\n`;
    mensagem += `🕐 *Aberto em:* ${criadoEm.toLocaleString('pt-BR', { 
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n`;
    mensagem += `⏱️ *Tempo decorrido:* ${tempoEspera} minutos\n`;
    mensagem += `📋 *Tipo:* ${chamadoAtivo.tipo_atendimento || 'Personalizado'}\n`;

    if (chamadoAtivo.status === "em_fila") {
      // Calcular posição na fila
      const { data: fila, error: filaError } = await supabase
        .from("chamados")
        .select("id, criado_em")
        .eq("status", "em_fila")
        .eq("unidade_id", unidade.id)
        .order("criado_em", { ascending: true });

      if (!filaError && fila) {
        const posicao = fila.findIndex((t) => t.id === chamadoAtivo.id) + 1;
        mensagem += `🎯 *Posição na fila:* #${posicao}\n`;
        mensagem += `👥 *Total na fila:* ${fila.length} chamados\n`;
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
    return new Response(JSON.stringify({ error: (err as any)?.message || 'Erro interno' }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }
});