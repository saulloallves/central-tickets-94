import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

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
    const phone = body?.body?.phone || body?.phone || body?.participantPhone;
    
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    console.log(`☑️ Finalizando emergência do grupo: ${phone}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar chamado de emergência ativo deste grupo
    const { data: chamado, error: chamadoError } = await supabase
      .from('chamados')
      .select('*')
      .eq('telefone', phone)
      .eq('is_emergencia', true)
      .in('status', ['emergencia', 'em_atendimento'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chamadoError || !chamado) {
      console.error("❌ Chamado de emergência não encontrado:", chamadoError);
      return new Response(JSON.stringify({ 
        error: "Chamado de emergência não encontrado" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }

    // Atualizar status do chamado para finalizado
    const { error: updateError } = await supabase
      .from('chamados')
      .update({ 
        status: 'finalizado',
        resolucao: 'Emergência encerrada pelo usuário',
        atualizado_em: new Date().toISOString()
      })
      .eq('id', chamado.id);

    if (updateError) {
      console.error("❌ Erro ao finalizar chamado:", updateError);
      return new Response(JSON.stringify({ 
        error: "Erro ao finalizar emergência",
        details: updateError.message 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    console.log(`✅ Chamado ${chamado.id} finalizado com sucesso`);

    // Enviar mensagem de confirmação
    const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
    const sendTextUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
    
    const sendTextRes = await fetch(sendTextUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Client-Token": clientToken
      },
      body: JSON.stringify({
        phone: phone,
        message: "✅ *EMERGÊNCIA ENCERRADA*\n\nO protocolo de emergência foi finalizado com sucesso.\n\nObrigado por utilizar nossos serviços! 🙏"
      }),
    });

    const sendTextData = await sendTextRes.json();
    console.log("✅ Mensagem de confirmação enviada:", sendTextData);

    return new Response(JSON.stringify({ 
      success: true,
      chamado_id: chamado.id,
      message: "Emergência finalizada com sucesso"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });

  } catch (err) {
    console.error("❌ Erro no emergencia_finalizar:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});
