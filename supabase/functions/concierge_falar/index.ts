import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadZAPIConfig } from "../_shared/zapi-config.ts";
import { isBusinessHours } from "../_shared/business-hours.ts";

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
    console.log("📩 Webhook concierge recebido:", body);

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

    // Verificar se está dentro do horário de atendimento
    if (!isBusinessHours()) {
      console.log("⏰ Fora do horário de atendimento - redirecionando para autoatendimento");
      
      // Carrega configurações Z-API para enviar mensagem de fora do horário
      const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
      
      const outOfHoursPayload = {
        phone,
        message: "❌ *Agora estamos fora do horário de atendimento.*\n\n⏰ Nosso time atende de segunda a sábado, das *8h30 às 17h30.*\n\n📝 Você pode abrir um ticket agora mesmo. Sua solicitação será registrada e respondida pela equipe assim que possível.",
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

      return new Response(JSON.stringify({ 
        success: true, 
        fora_do_horario: true,
        data 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
    }

    // Conecta no Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // 1. Busca a unidade na tabela LOCAL atendente_unidades
    const { data: atendenteUnidade, error: unidadeError } = await supabase
      .from("atendente_unidades")
      .select("id, codigo_grupo, grupo, id_grupo_branco, concierge_name, concierge_phone, unidade_id_externo, atendente_id")
      .eq("id_grupo_branco", phone)
      .eq("ativo", true)
      .maybeSingle();

    if (unidadeError || !atendenteUnidade) {
      console.error("❌ Unidade não encontrada:", unidadeError);
      return new Response(JSON.stringify({ error: "Unidade não encontrada" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }
    console.log("✅ Unidade encontrada:", atendenteUnidade);

    // 1.5 Verificar se já existe um atendimento ativo para este telefone
    const { data: chamadoExistente, error: verificacaoError } = await supabase
      .from("chamados")
      .select("id, status, criado_em")
      .eq("telefone", phone)
      .eq("unidade_id", atendenteUnidade.id)
      .in("status", ["em_fila", "em_atendimento"])
      .maybeSingle();

    if (verificacaoError) {
      console.error("❌ Erro ao verificar chamados existentes:", verificacaoError);
    }

    // Se já existe um atendimento ativo, não criar novo
    if (chamadoExistente) {
      console.log("⚠️ Atendimento já existe:", chamadoExistente);

      // Buscar atendente do chamado existente via codigo_grupo
      const { data: atendenteUnidadeExistente } = await supabase
        .from("atendente_unidades")
        .select("atendente_id")
        .eq("codigo_grupo", atendenteUnidade.codigo_grupo)
        .eq("ativo", true)
        .maybeSingle();

      const atendenteIdExistente = atendenteUnidadeExistente?.atendente_id;
      console.log(`👤 Atendente para chamado existente: ${atendenteIdExistente || 'Nenhum'}`);

      // Buscar posição na fila se estiver em fila
      let posicao = null;
      if (chamadoExistente.status === "em_fila") {
        // Se tiver atendente, filtrar pela fila desse atendente específico
        let query = supabase
          .from("chamados")
          .select("id, criado_em, atendente_id")
          .in("status", ["em_fila", "em_atendimento"])
          .eq("tipo_atendimento", "concierge");

        if (atendenteIdExistente) {
          query = query.eq("atendente_id", atendenteIdExistente);
          console.log(`🔍 Filtrando fila por atendente_id: ${atendenteIdExistente}`);
        } else {
          query = query.eq("unidade_id", atendenteUnidade.id);
          console.log(`🔍 Filtrando fila por unidade_id (sem atendente): ${atendenteUnidade.id}`);
        }

        const { data: fila } = await query.order("criado_em", { ascending: true });

        if (fila) {
          // Contar apenas os que estão em_fila antes deste
          const emFila = fila.filter(c => c.status === "em_fila" || c.criado_em < chamadoExistente.criado_em);
          posicao = emFila.findIndex((c) => c.id === chamadoExistente.id) + 1;
          
          const emAtendimento = fila.filter(c => c.status === "em_atendimento").length;
          console.log(`📊 Fila do atendente: ${fila.length} total (${emAtendimento} em atendimento, ${fila.length - emAtendimento} aguardando)`);
          console.log(`📊 Posição na fila: ${posicao}`);
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
      if (chamadoExistente.status === "em_fila") {
        await enviarZapi("send-button-list", {
          phone,
          message: `⏳ *Você já possui um atendimento personalizado na fila*\n\n📊 Sua posição: *#${posicao}*\n\nPor favor, aguarde sua vez. Você receberá uma mensagem quando for atendido.\n\nSe desejar, pode finalizar ou transferir abaixo:`,
          buttonList: {
            buttons: [
              { id: "personalizado_finalizar", label: "✅ Finalizar atendimento" },
              { id: "autoatendimento_menu", label: "🔄 Transferir para autoatendimento" },
            ],
          },
        });
      } else if (chamadoExistente.status === "em_atendimento") {
        await enviarZapi("send-text", {
          phone,
          message: `👥 *Você já está sendo atendido*\n\nVocê já possui um atendimento personalizado em andamento com nossa equipe.\n\nContinue a conversação aqui mesmo.`,
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

    // 2. Buscar atendente correto via atendente_id da unidade
    let atendenteNome = "Concierge"; // fallback
    let atendenteId = atendenteUnidade.atendente_id;

    if (atendenteId) {
      const { data: atendente } = await supabase
        .from("atendentes")
        .select("nome")
        .eq("id", atendenteId)
        .eq("tipo", "concierge")
        .eq("status", "ativo")
        .eq("ativo", true)
        .maybeSingle();

      if (atendente) {
        atendenteNome = atendente.nome;
        console.log(`✅ Atendente encontrado: ${atendenteNome} (${atendenteId})`);
      }
    }

    // 3. Cria um novo chamado
    const { data: chamado, error: chamadoError } = await supabase
      .from("chamados")
      .insert({
        unidade_id: atendenteUnidade.id,
        tipo_atendimento: "concierge",
        status: "em_fila",
        telefone: phone,
        franqueado_nome: atendenteUnidade.grupo,
        atendente_nome: atendenteNome,
        atendente_id: atendenteId,
        descricao: "Solicitação de atendimento via Concierge",
      })
      .select()
      .single();

    if (chamadoError) {
      console.error("❌ Erro ao criar chamado:", chamadoError);
      return new Response(JSON.stringify({ error: "Falha ao criar chamado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }
    console.log("🎫 Chamado criado:", chamado);

    // 4. Conta posição na fila do atendente específico
    console.log(`👤 Calculando fila para atendente: ${atendenteId || 'Nenhum atendente'}`);
    
    // Se tiver atendente, filtrar pela fila desse atendente específico
    let query = supabase
      .from("chamados")
      .select("id, criado_em, status, atendente_id")
      .in("status", ["em_fila", "em_atendimento"])
      .eq("tipo_atendimento", "concierge");

    if (atendenteId) {
      query = query.eq("atendente_id", atendenteId);
      console.log(`🔍 Filtrando fila por atendente_id: ${atendenteId}`);
    } else {
      query = query.eq("unidade_id", atendenteUnidade.id);
      console.log(`🔍 Filtrando fila por unidade_id (sem atendente): ${atendenteUnidade.id}`);
    }

    const { data: fila, error: filaError } = await query.order("criado_em", { ascending: true });

    if (filaError) {
      console.error("❌ Erro ao buscar fila:", filaError);
      return new Response(JSON.stringify({ error: "Erro ao buscar fila" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    // Separar chamados em atendimento e em fila
    const emAtendimento = fila.filter(c => c.status === "em_atendimento");
    const apenasEmFila = fila.filter(c => c.status === "em_fila");
    
    // Posição é baseada apenas nos que estão em_fila (não conta os em_atendimento)
    const posicao = apenasEmFila.findIndex((c) => c.id === chamado.id) + 1;
    const totalNaFrente = emAtendimento.length + (posicao - 1);
    
    console.log(`📊 Fila do atendente "${atendenteNome}":`);
    console.log(`   - ${emAtendimento.length} em atendimento`);
    console.log(`   - ${apenasEmFila.length} aguardando na fila`);
    console.log(`   - ${totalNaFrente} chamados na frente deste`);
    console.log(`   - Posição na fila de espera: ${posicao}`);

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

    // 5. Mensagem com posição na fila do atendente
    let mensagem = "";
    
    if (totalNaFrente === 0) {
      mensagem = `📥 *Você é o próximo na fila!*\n\n👤 Atendente: *${atendenteNome}*\n⏳ Por favor, permaneça aqui. Você receberá uma mensagem em instântes.\n\nSe desejar encerrar o atendimento ou alterar para autoatendimento, selecione abaixo:`;
    } else {
      mensagem = `⏳ *Você entrou na fila de atendimento personalizado*\n\n👤 Atendente: *${atendenteNome}*\n📊 Número de chamados na sua frente: *${totalNaFrente}*\n${emAtendimento.length > 0 ? `   (${emAtendimento.length} em atendimento + ${posicao - 1} aguardando)\n` : ''}\nPor favor, permaneça aqui. Assim que for sua vez, você receberá uma mensagem diretamente.\n\nSe desejar encerrar ou transferir para autoatendimento, selecione abaixo:`;
    }

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