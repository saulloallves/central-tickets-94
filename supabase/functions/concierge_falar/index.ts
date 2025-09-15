import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
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

    // Conecta no Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Busca a unidade correspondente ao grupo
    const { data: unidade, error: unidadeError } = await supabase
      .from("unidades")
      .select("id, grupo, codigo_grupo")
      .eq("id_grupo_branco", phone)
      .single();

    if (unidadeError || !unidade) {
      console.error("❌ Unidade não encontrada:", unidadeError);
      return new Response(JSON.stringify({ error: "Unidade não encontrada para o grupo informado" }), {
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
        franqueado_nome: "Concierge",
        descricao: "Solicitação de atendimento via Concierge"
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

    // 3. Enviar confirmação via Z-API
    const instanceId = Deno.env.get("ZAPI_INSTANCE_ID");
    const instanceToken = Deno.env.get("ZAPI_TOKEN");
    const clientToken = Deno.env.get("ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_TOKEN");
    const baseUrl = Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";

    if (instanceId && instanceToken && clientToken) {
      const payload = {
        phone,
        message: `✅ *Chamado Criado com Sucesso!*\n\n🎫 *ID:* ${chamado.id}\n👥 *Concierge:* ${unidade.grupo}\n⏰ *Status:* Em fila de atendimento\n\nEm breve um de nossos atendentes entrará em contato.`
      };

      const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
      
      try {
        const res = await fetch(zapiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Client-Token": clientToken,
          },
          body: JSON.stringify(payload),
        });

        const data = await res.json();
        console.log("📤 Confirmação enviada via Z-API:", data);
      } catch (error) {
        console.error("❌ Erro ao enviar confirmação:", error);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: "Chamado criado com sucesso",
      chamado
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