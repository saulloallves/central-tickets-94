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
    console.log("📩 Finalizando atendimento:", body);

    // Extrai o phone do grupo
    const phone = body?.phone || body?.participantPhone;
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado no payload" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    // Conecta no Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL"),
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
    );

    // 1. Busca o chamado ativo para este telefone
    const { data: chamado, error: chamadoError } = await supabase
      .from("chamados")
      .select("*")
      .eq("telefone", phone)
      .eq("status", "em_fila")
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chamadoError) {
      console.error("❌ Erro ao buscar chamado:", chamadoError);
      return new Response(JSON.stringify({ error: "Erro ao buscar chamado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    if (!chamado) {
      console.log("❌ Nenhum chamado ativo encontrado para:", phone);
      
      // Carrega configurações Z-API para enviar mensagem mesmo sem chamado ativo
      const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
      const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}`;

      try {
        await fetch(`${zapiUrl}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": clientToken },
          body: JSON.stringify({
            phone,
            message: "ℹ️ **Não há atendimento ativo para finalizar.**\n\nSe precisar de ajuda, digite *menu* para ver as opções disponíveis.",
          }),
        });
      } catch (err) {
        console.error("❌ Erro ao enviar Z-API:", err);
      }

      return new Response(JSON.stringify({ error: "Nenhum chamado ativo encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }

    console.log("✅ Chamado encontrado:", chamado);

    // 2. Finaliza o chamado
    const { error: updateError } = await supabase
      .from("chamados")
      .update({
        status: "finalizado",
        atualizado_em: new Date().toISOString(),
        resolucao: "Atendimento finalizado pelo usuário via bot",
      })
      .eq("id", chamado.id);

    if (updateError) {
      console.error("❌ Erro ao finalizar chamado:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao finalizar chamado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    console.log("✅ Chamado finalizado com sucesso");

    // 3. Carrega configurações Z-API
    const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
    const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}`;

    // 4. Envia mensagem de confirmação com botões de avaliação
    try {
      const response = await fetch(`${zapiUrl}/send-button-list`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Client-Token": clientToken },
        body: JSON.stringify({
          phone,
          message: "✅ *Atendimento finalizado com sucesso!*\n\n🙏 Obrigado por entrar em contato conosco.\n\n⭐ *Avalie este atendimento*\nSua opinião é muito importante para melhorarmos nossos serviços.\n\nSe precisar de mais ajuda, digite *menu* para ver todas as opções disponíveis.",
          buttonList: {
            buttons: [
              { id: "avaliacao_otimo", label: "😊 Consegui resolver tudo" },
              { id: "avaliacao_bom", label: "😐 Foi útil, mas poderia melhorar" },
              { id: "avaliacao_ruim", label: "😞 Não resolveu o que eu precisava" }
            ]
          }
        }),
      });
      
      const zapiData = await response.json();
      console.log("📤 Mensagem de finalização enviada:", zapiData);
    } catch (err) {
      console.error("❌ Erro ao enviar mensagem de confirmação:", err);
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Atendimento finalizado com sucesso",
      chamado_id: chamado.id 
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