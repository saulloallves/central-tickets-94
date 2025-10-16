import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadZAPIConfig } from "../_shared/zapi-config.ts";
import { isDFCOMBusinessHours } from "../_shared/business-hours.ts";

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

      // Verificar modo silencioso (para integração com Typebot)
      const silentMode = body?.silent_mode === true;
      console.log(`🔇 Silent Mode: ${silentMode}`);

      // Extrai o phone do grupo
      const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado no payload" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    // Verificar se está dentro do horário de atendimento DFCOM (estendido até 18h30)
    if (!isDFCOMBusinessHours()) {
      console.log("⏰ Fora do horário de atendimento DFCOM - redirecionando para autoatendimento");
      
      const mensagemForaHorario = "❌ *Agora estamos fora do horário de atendimento.*\n\n⏰ Nosso time DFCom atende de segunda a sábado, das *8h30 às 18h30.*\n\n📝 Você pode abrir um ticket agora mesmo. Sua solicitação será registrada e respondida pela equipe assim que possível.";
      
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

    // 1. Buscar atendente DFCom disponível (necessário antes de criar o chamado)
    const { data: atendenteDFCom, error: atendenteError } = await supabase
      .from('atendentes')
      .select('id, nome')
      .eq('tipo', 'dfcom')
      .eq('status', 'ativo')
      .eq('ativo', true)
      .maybeSingle();

    if (atendenteError || !atendenteDFCom) {
      console.error("❌ Atendente DFCom não encontrado:", atendenteError);
      return new Response(JSON.stringify({ error: "Atendente DFCom não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }
    console.log("✅ Atendente DFCom encontrado:", atendenteDFCom);

    // 2. Busca a unidade correspondente ao grupo no projeto externo
    const { data: unidadeExterna, error: unidadeError } = await externalSupabase
      .from("unidades")
      .select("id, grupo, codigo_grupo, concierge_name, concierge_phone")
      .eq("id_grupo_branco", phone)
      .limit(1)
      .single();

    if (unidadeError || !unidadeExterna) {
      console.error("❌ Unidade externa não encontrada:", unidadeError);
      return new Response(JSON.stringify({ error: "Unidade não encontrada" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }
    console.log("✅ Unidade externa encontrada:", unidadeExterna);

    // 3. Buscar unidade local (atendente_unidades) usando codigo_grupo
    const { data: unidadeLocal, error: unidadeLocalError } = await supabase
      .from("atendente_unidades")
      .select("id, grupo, codigo_grupo, atendente_id")
      .eq("codigo_grupo", unidadeExterna.codigo_grupo)
      .eq("ativo", true)
      .maybeSingle();

    if (unidadeLocalError || !unidadeLocal) {
      console.error("❌ Unidade local não encontrada:", unidadeLocalError);
      return new Response(JSON.stringify({ error: "Unidade local não encontrada" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }
    console.log("✅ Unidade local encontrada:", unidadeLocal);

    // 4. Verificar se já existe um atendimento ativo DFCom para este telefone
    const { data: chamadoExistente, error: verificacaoError } = await supabase
      .from("chamados")
      .select("id, status, criado_em")
      .eq("telefone", phone)
      .eq("unidade_id", unidadeLocal.id)
      .eq("tipo_atendimento", "dfcom")
      .in("status", ["em_fila", "em_atendimento"])
      .maybeSingle();

    if (verificacaoError) {
      console.error("❌ Erro ao verificar chamados existentes:", verificacaoError);
    }

    // Se já existe um atendimento DFCom ativo, não criar novo
    if (chamadoExistente) {
      console.log("⚠️ Atendimento DFCom já existe:", chamadoExistente);

      // Buscar posição na fila GLOBAL se estiver em fila ou em atendimento
      let posicao = null;
      if (chamadoExistente.status === "em_fila" || chamadoExistente.status === "em_atendimento") {
        const { data: fila } = await supabase
          .from("chamados")
          .select("id, criado_em")
          .in("status", ["em_fila", "em_atendimento"])
          .eq("tipo_atendimento", "dfcom")
          .order("criado_em", { ascending: true });

        if (fila) {
          posicao = fila.findIndex((c) => c.id === chamadoExistente.id) + 1;
        }
      }

      // Carrega configurações Z-API
      const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
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
      let mensagem = "";
      
      if (chamadoExistente.status === "em_fila") {
        mensagem = `⏳ *Você já possui um atendimento DFCom na fila*\n\n📊 Sua posição: *#${posicao}*\n\nPor favor, aguarde sua vez. Você receberá uma mensagem quando for atendido.`;
        
        if (!silentMode) {
          await enviarZapi("send-text", {
            phone,
            message: mensagem,
          });
        }
      } else if (chamadoExistente.status === "em_atendimento") {
        mensagem = `👥 *Você já está sendo atendido pela equipe DFCom*\n\nVocê já possui um atendimento técnico em andamento com nossa equipe.\n\nContinue a conversação aqui mesmo.`;
        
        if (!silentMode) {
          await enviarZapi("send-text", {
            phone,
            message: mensagem,
          });
        }
      }

      return new Response(JSON.stringify({ 
        success: true, 
        atendimento_existente: true,
        chamado: chamadoExistente,
        posicao,
        mensagem_gerada: mensagem
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    // 5. Criar novo chamado DFCom
    const { data: chamado, error: chamadoError } = await supabase
      .from("chamados")
      .insert({
        unidade_id: unidadeLocal.id,
        tipo_atendimento: "dfcom",
        status: "em_fila",
        telefone: phone,
        franqueado_nome: unidadeExterna.grupo,
        atendente_nome: atendenteDFCom.nome,
        atendente_id: atendenteDFCom.id,
        descricao: "Solicitação de suporte técnico via DFCom",
        categoria: "suporte_tecnico",
        prioridade: "normal",
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

    // 6. Calcular posição na fila GLOBAL da DFCom (todas as unidades)
    const { data: fila, error: filaError } = await supabase
      .from("chamados")
      .select("id, criado_em, status")
      .in("status", ["em_fila", "em_atendimento"])
      .eq("tipo_atendimento", "dfcom")
      .order("criado_em", { ascending: true });

    if (filaError) {
      console.error("❌ Erro ao buscar fila DFCom:", filaError);
      return new Response(JSON.stringify({ error: "Erro ao buscar fila DFCom" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    // Posição na fila GLOBAL (conta em_fila + em_atendimento)
    const posicao = fila.findIndex((c) => c.id === chamado.id) + 1;
    
    console.log(`📊 Fila GLOBAL DFCom: ${fila.length} atendimentos (em_fila + em_atendimento)`);
    console.log(`   - Posição deste chamado: #${posicao}`);

    // 4. Log do chamado criado (grupo será adicionado quando atendente aceitar)
    console.log('📋 Chamado DFCom criado para fila, aguardando atendente aceitar no kanban');

    // Carrega configurações Z-API
    const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
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

    // 5. Mensagem com posição na fila
    const mensagem = `🧾 Seu número na fila é: *#${posicao}*\n\nPor favor, permaneça aqui. Assim que for sua vez, você receberá uma mensagem diretamente por aqui.\n\nSe desejar encerrar o atendimento ou alterar a maneira de atendimento para autoatendimento, selecione um dos botões abaixo:`;

    if (!silentMode) {
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
    }

    return new Response(JSON.stringify({ 
      success: true, 
      chamado, 
      posicao,
      mensagem_gerada: mensagem 
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