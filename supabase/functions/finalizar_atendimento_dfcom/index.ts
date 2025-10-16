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
    const uniqueId = Math.random().toString(36).substring(7);
    console.log(`📩 [${uniqueId}] Finalizando atendimento DFCom:`, body);

    // Verificar modo silencioso (para integração com Typebot)
    const silentMode = body?.silent_mode === true;
    console.log(`🔇 Silent Mode: ${silentMode}`);

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

    // 1. Busca o chamado DFCom ativo para este telefone
    const { data: chamado, error: chamadoError } = await supabase
      .from("chamados")
      .select("*")
      .eq("telefone", phone)
      .eq("tipo_atendimento", "dfcom")
      .in("status", ["em_fila", "em_atendimento"])
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chamadoError) {
      console.error("❌ Erro ao buscar chamado DFCom:", chamadoError);
      return new Response(JSON.stringify({ error: "Erro ao buscar chamado DFCom" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    if (!chamado) {
      console.log("❌ Nenhum chamado DFCom ativo encontrado para:", phone);
      
      // Carrega configurações Z-API para enviar mensagem mesmo sem chamado ativo
      const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
      const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}`;

      try {
        await fetch(`${zapiUrl}/send-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Client-Token": clientToken },
          body: JSON.stringify({
            phone,
            message: "ℹ️ **Não há atendimento DFCom ativo para finalizar.**\n\nSe precisar de ajuda, digite *menu* para ver as opções disponíveis.",
          }),
        });
      } catch (err) {
        console.error("❌ Erro ao enviar Z-API:", err);
      }

      return new Response(JSON.stringify({ error: "Nenhum chamado DFCom ativo encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }

    console.log("✅ Chamado DFCom encontrado:", chamado);

    // 2. Remover do grupo WhatsApp antes de finalizar
    try {
      const functionsBaseUrl = Deno.env.get("FUNCTIONS_BASE_URL") || 
        `https://hryurntaljdisohawpqf.supabase.co/functions/v1`;
      
      const removeFromGroupResponse = await fetch(`${functionsBaseUrl}/remove-from-whatsapp-group`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({ chamadoId: chamado.id }),
      });

      if (removeFromGroupResponse.ok) {
        console.log('✅ DFCom removido do grupo WhatsApp');
      } else {
        console.error('❌ Erro ao remover DFCom do grupo:', await removeFromGroupResponse.text());
      }
    } catch (groupError) {
      console.error('❌ Erro na integração com grupo WhatsApp:', groupError);
    }

    // 3. Finaliza o chamado DFCom
    const { error: updateError } = await supabase
      .from("chamados")
      .update({
        status: "finalizado",
        atualizado_em: new Date().toISOString(),
        resolucao: "Atendimento DFCom finalizado pelo usuário via bot",
      })
      .eq("id", chamado.id);

    if (updateError) {
      console.error("❌ Erro ao finalizar chamado DFCom:", updateError);
      return new Response(JSON.stringify({ error: "Erro ao finalizar chamado DFCom" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    console.log("✅ Chamado DFCom finalizado com sucesso");

    // A mensagem de avaliação já é enviada pela função remove-from-whatsapp-group
    // Não é necessário enviar mensagem adicional aqui

    return new Response(JSON.stringify({ 
      success: true, 
      message: "Atendimento DFCom finalizado com sucesso",
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