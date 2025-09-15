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
    console.log("📩 Webhook concierge recebido:", body);

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
      .select("id, grupo, codigo_grupo")
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

    // 2. Cria um novo chamado
    const { data: chamado, error: chamadoError } = await supabase
      .from("chamados")
      .insert({
        unidade_id: unidade.id,
        tipo_atendimento: "concierge",
        status: "em_fila",
        telefone: phone,
        franqueado_nome: unidade.grupo,
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

    // 3. Conta posição na fila
    const { data: fila, error: filaError } = await supabase
      .from("chamados")
      .select("id, criado_em")
      .eq("status", "em_fila")
      .eq("unidade_id", unidade.id)
      .order("criado_em", { ascending: true });

    if (filaError) {
      console.error("❌ Erro ao buscar fila:", filaError);
      return new Response(JSON.stringify({ error: "Erro ao buscar fila" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    const posicao = fila.findIndex((c) => c.id === chamado.id) + 1;
    console.log(`📊 Posição na fila: ${posicao}`);

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

    // 4. Mensagem inicial
    await enviarZapi("send-text", {
      phone,
      message: "⏳ Você entrou na *fila de atendimento personalizado*.\n\nAguarde um momento — estamos organizando os atendimentos em ordem de chegada.",
    });

    // 5. Próximo ou posição
    if (posicao === 1) {
      await enviarZapi("send-button-list", {
        phone,
        message:
          "📥 *Você é o próximo na fila de atendimento*\n\nPor favor, permaneça aqui. Você receberá uma mensagem em instântes.\n\nSe desejar encerrar o atendimento ou alterar a maneira de atendimento para autoatendimento, selecione um dos botões abaixo:",
        buttonList: {
          buttons: [
            { id: "personalizado_finalizar", label: "✅ Finalizar atendimento" },
            { id: "autoatendimento_menu", label: "🔄 Transferir para autoatendimento" },
          ],
        },
      });
    } else {
      await enviarZapi("send-button-list", {
        phone,
        message: `🧾 Seu número na fila é: *#${posicao}*\n\nPor favor, permaneça aqui. Assim que for sua vez, você receberá uma mensagem diretamente por aqui.\n\nSe desejar encerrar o atendimento ou alterar a maneira de atendimento para autoatendimento, selecione um dos botões abaixo:`,
        buttonList: {
          buttons: [
            { id: "personalizado_finalizar", label: "✅ Finalizar atendimento" },
            { id: "autoatendimento_menu", label: "🔄 Transferir para autoatendimento" },
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