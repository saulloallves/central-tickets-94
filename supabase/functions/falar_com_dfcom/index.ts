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
    console.log("📩 Webhook DFCom recebido:", body);

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
      return new Response(JSON.stringify({ error: "Unidade não encontrada" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }
    console.log("✅ Unidade encontrada:", unidade);

    // 1.5 Verificar se já existe um atendimento ativo DFCom para este telefone
    const { data: chamadoExistente, error: verificacaoError } = await supabase
      .from("chamados")
      .select("id, status, criado_em")
      .eq("telefone", phone)
      .eq("unidade_id", unidade.id)
      .eq("tipo_atendimento", "dfcom")
      .in("status", ["em_fila", "em_atendimento"])
      .maybeSingle();

    if (verificacaoError) {
      console.error("❌ Erro ao verificar chamados existentes:", verificacaoError);
    }

    // Se já existe um atendimento DFCom ativo, não criar novo
    if (chamadoExistente) {
      console.log("⚠️ Atendimento DFCom já existe:", chamadoExistente);

      // Buscar posição na fila se estiver em fila
      let posicao = null;
      if (chamadoExistente.status === "em_fila") {
        const { data: fila } = await supabase
          .from("chamados")
          .select("id, criado_em")
          .eq("status", "em_fila")
          .eq("unidade_id", unidade.id)
          .eq("tipo_atendimento", "dfcom")
          .order("criado_em", { ascending: true });

        if (fila) {
          posicao = fila.findIndex((c) => c.id === chamadoExistente.id) + 1;
        }
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

      // Enviar mensagem adequada baseada no status
      if (chamadoExistente.status === "em_fila") {
        await enviarZapi("send-text", {
          phone,
          message: `⏳ *Você já possui um atendimento DFCom na fila*\n\n📊 Sua posição: *#${posicao}*\n\nPor favor, aguarde sua vez. Você receberá uma mensagem quando for atendido.`,
        });
      } else if (chamadoExistente.status === "em_atendimento") {
        await enviarZapi("send-text", {
          phone,
          message: `👥 *Você já está sendo atendido pela equipe DFCom*\n\nVocê já possui um atendimento técnico em andamento com nossa equipe.\n\nContinue a conversação aqui mesmo.`,
        });
      }

      return new Response(JSON.stringify({ 
        success: true, 
        atendimento_existente: true,
        chamado: chamadoExistente,
        posicao 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    // 2. Cria um novo chamado DFCom
    const { data: chamado, error: chamadoError } = await supabase
      .from("chamados")
      .insert({
        unidade_id: unidade.id,
        tipo_atendimento: "dfcom",
        status: "em_fila",
        telefone: phone,
        franqueado_nome: unidade.grupo,
        atendente_nome: "Equipe DFCom",
        descricao: "Solicitação de suporte técnico via DFCom",
      })
      .select()
      .single();

    if (chamadoError) {
      console.error("❌ Erro ao criar chamado DFCom:", chamadoError);
      return new Response(JSON.stringify({ error: "Falha ao criar chamado DFCom" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }
    console.log("🎫 Chamado DFCom criado:", chamado);

    // 3. Conta posição na fila DFCom
    const { data: fila, error: filaError } = await supabase
      .from("chamados")
      .select("id, criado_em")
      .eq("status", "em_fila")
      .eq("unidade_id", unidade.id)
      .eq("tipo_atendimento", "dfcom")
      .order("criado_em", { ascending: true });

    if (filaError) {
      console.error("❌ Erro ao buscar fila DFCom:", filaError);
      return new Response(JSON.stringify({ error: "Erro ao buscar fila DFCom" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    const posicao = fila.findIndex((c) => c.id === chamado.id) + 1;
    console.log(`📊 Posição na fila DFCom: ${posicao}`);

    // 4. Log do chamado criado (grupo será adicionado quando atendente aceitar)
    console.log('📋 Chamado DFCom criado para fila, aguardando atendente aceitar no kanban');

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

    // 5. Mensagem inicial
    await enviarZapi("send-text", {
      phone,
      message: "⚫ Você entrou na *fila de suporte técnico DFCom*.\n\nAguarde um momento — nossa equipe técnica está organizando os atendimentos em ordem de chegada.",
    });

    // 6. Próximo ou posição
    if (posicao === 1) {
      await enviarZapi("send-button-list", {
        phone,
        message:
          "📥 *Você é o próximo na fila DFCom*\n\nPor favor, permaneça aqui. Nossa equipe técnica entrará em contato em instantes.\n\nSe desejar encerrar o atendimento ou alterar para autoatendimento, selecione um dos botões abaixo:",
        buttonList: {
          buttons: [
            { id: "finalizar_atendimento_dfcom", label: "📱 Finalizar Atendimento" },
            { id: "autoatendimento_menu", label: "🔄 Transferir para Autoatendimento" },
            { id: "voltar_menu_inicial", label: "🏠 Voltar ao Menu Inicial" },
          ],
        },
      });
    } else {
      await enviarZapi("send-button-list", {
        phone,
        message: `🧾 Seu número na fila DFCom: *#${posicao}*\n\nPor favor, permaneça aqui. Assim que for sua vez, nossa equipe técnica entrará em contato por aqui.\n\nSe desejar encerrar o atendimento ou alterar para autoatendimento, selecione um dos botões abaixo:`,
        buttonList: {
          buttons: [
            { id: "finalizar_atendimento_dfcom", label: "📱 Finalizar Atendimento" },
            { id: "autoatendimento_menu", label: "🔄 Transferir para Autoatendimento" },
            { id: "voltar_menu_inicial", label: "🏠 Voltar ao Menu Inicial" },
          ],
        },
      });
    }

    return new Response(JSON.stringify({ success: true, chamado, posicao }), {
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