import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from "../_shared/zapi-config.ts";
import { isBusinessHours } from "../_shared/business-hours.ts";

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

    console.log(`🚨 Emergência solicitada do grupo: ${phone} [v3.0]`);

    // Verificar horário comercial
    if (!isBusinessHours()) {
      console.log("⏰ Fora do horário comercial - ativando protocolo de emergência estendido");
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Buscar números de emergência configurados
      const { data: settingsData } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'emergency_numbers')
        .maybeSingle();

      let emergencyNumbers = [];
      if (settingsData?.setting_value) {
        try {
          emergencyNumbers = JSON.parse(settingsData.setting_value);
          console.log(`📋 ${emergencyNumbers.length} números de emergência configurados`);
        } catch (e) {
          console.error('❌ Erro ao parsear números de emergência:', e);
        }
      }

      // Buscar concierge da unidade no Supabase externo
      const externalSupabase = createClient(
        Deno.env.get("EXTERNAL_SUPABASE_URL") ?? '',
        Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ?? ''
      );

      const { data: unidade } = await externalSupabase
        .from('unidades')
        .select('concierge_phone')
        .eq('id_grupo_branco', phone)
        .maybeSingle();

      const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
      const headers = { "Content-Type": "application/json", "Client-Token": clientToken };

      // Montar lista de números para adicionar e mencionar
      const phonesToAdd = emergencyNumbers.map((num: any) => num.phone);
      const phonesToMention = [...phonesToAdd];
      
      if (unidade?.concierge_phone) {
        let conciergePhone = String(unidade.concierge_phone).replace(/\D/g, '');
        if (!conciergePhone.startsWith('55') && conciergePhone.length === 11) {
          conciergePhone = '55' + conciergePhone;
        }
        phonesToAdd.push(conciergePhone);
        phonesToMention.push(conciergePhone);
        console.log(`📞 Concierge da unidade: ${conciergePhone}`);
      }

      console.log(`👥 Total de participantes a adicionar: ${phonesToAdd.length}`);

      // Adicionar participantes ao grupo
      if (phonesToAdd.length > 0) {
        const addUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/add-participant`;
        const addRes = await fetch(addUrl, {
          method: "POST",
          headers,
          body: JSON.stringify({
            groupId: phone,
            phones: phonesToAdd,
          }),
        });
        const addData = await addRes.json();
        console.log("✅ Participantes adicionados:", addData);
      }

      // Montar mensagem com mentions
      const mentionText = phonesToMention.map(p => `@${p}`).join(' ');
      const messageText = `🚨 *PROTOCOLO EMERGÊNCIA* 🚨\n\nAdicionamos ${mentionText} para auxiliar sua unidade\n\n*De maneira direta, nos informe o ocorrido para que possamos auxiliar com mais rapidez.*`;

      // Enviar mensagem com botão
      const zapiUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
      
      const res = await fetch(zapiUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          phone: phone,
          message: messageText,
          mentioned: phonesToMention,
          buttonList: {
            buttons: [
              {
                id: "emergencia_finalizar",
                label: "☑️ Encerrar emergência"
              }
            ]
          }
        }),
      });

      const responseData = await res.json();
      console.log("✅ Mensagem de emergência enviada:", responseData);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Protocolo de emergência ativado (fora do horário)",
          participants_added: phonesToAdd.length
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Dentro do horário comercial - processar emergência
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Conecta no Supabase externo (para unidades)
    const externalSupabase = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? '',
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ?? ''
    );

    // Buscar unidade pelo código do grupo no Supabase externo
    console.log(`🔍 Buscando unidade com id_grupo_branco: ${phone}`);
    
    const { data: unidade, error: unidadeError } = await externalSupabase
      .from('unidades')
      .select('id, grupo, codigo_grupo, concierge_name, concierge_phone')
      .eq('id_grupo_branco', phone)
      .maybeSingle();

    if (unidadeError) {
      console.error("❌ Erro ao buscar unidade:", JSON.stringify(unidadeError));
      return new Response(JSON.stringify({ 
        error: "Erro ao buscar unidade",
        details: unidadeError?.message,
        code: unidadeError?.code
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    if (!unidade) {
      console.error("❌ Unidade não encontrada para grupo:", phone);
      return new Response(JSON.stringify({ 
        error: "Unidade não encontrada para este grupo"
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }

    console.log(`✅ Unidade encontrada:`, JSON.stringify(unidade));

    // Buscar atendente correto da tabela atendente_unidades e atendentes
    const { data: atendenteUnidade } = await supabase
      .from('atendente_unidades')
      .select('atendente_id')
      .eq('id', unidade.id)
      .eq('ativo', true)
      .maybeSingle();

    let conciergePhone = unidade.concierge_phone;
    let conciergeName = unidade.concierge_name || 'Concierge';
    let atendenteId = null;

    if (atendenteUnidade?.atendente_id) {
      const { data: atendente } = await supabase
        .from('atendentes')
        .select('id, nome, telefone')
        .eq('id', atendenteUnidade.atendente_id)
        .eq('tipo', 'concierge')
        .eq('ativo', true)
        .maybeSingle();

      if (atendente) {
        conciergePhone = atendente.telefone || conciergePhone;
        conciergeName = atendente.nome || conciergeName;
        atendenteId = atendente.id;
        console.log(`✅ Atendente encontrado: ${conciergeName} (${atendenteId})`);
      }
    }

    if (!conciergePhone) {
      console.error("❌ Telefone do concierge não encontrado");
      return new Response(JSON.stringify({ 
        error: "Concierge não configurado para esta unidade" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }

    // Criar chamado de emergência
    const { data: chamado, error: chamadoError } = await supabase
      .from('chamados')
      .insert({
        unidade_id: unidade.id,
        franqueado_nome: unidade.grupo || 'Emergência',
        telefone: phone,
        descricao: '🚨 EMERGÊNCIA - Atendimento prioritário solicitado',
        tipo_atendimento: 'emergencia',
        status: 'emergencia',
        prioridade: 'urgente',
        categoria: 'emergencia',
        atendente_id: atendenteId,
        atendente_nome: conciergeName,
        is_emergencia: true
      })
      .select()
      .single();

    if (chamadoError) {
      console.error("❌ Erro ao criar chamado:", chamadoError);
      return new Response(JSON.stringify({ 
        error: "Erro ao criar chamado de emergência",
        details: chamadoError.message 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 500,
      });
    }

    console.log(`✅ Chamado emergencial criado: ${chamado.id}`);

    // Configurações Z-API
    const { instanceId, instanceToken, clientToken, baseUrl } = await loadZAPIConfig();
    const headers = { "Content-Type": "application/json", "Client-Token": clientToken };

    // 1. Adicionar concierge no grupo
    console.log(`📞 Adicionando concierge ${conciergePhone} ao grupo ${phone}`);
    const addParticipantUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/add-participant`;
    const addParticipantRes = await fetch(addParticipantUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        groupId: phone,
        phones: [conciergePhone]
      }),
    });

    const addParticipantData = await addParticipantRes.json();
    console.log("✅ Resultado add-participant:", addParticipantData);

    // 2. Tornar concierge admin do grupo
    console.log(`👑 Tornando concierge admin do grupo`);
    const addAdminUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/add-admin`;
    const addAdminRes = await fetch(addAdminUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        groupId: phone,
        phones: [conciergePhone]
      }),
    });

    const addAdminData = await addAdminRes.json();
    console.log("✅ Resultado add-admin:", addAdminData);

    // 3. Enviar mensagem com mention e botão
    console.log(`💬 Enviando mensagem de emergência com mention`);
    const sendTextUrl = `${baseUrl}/instances/${instanceId}/token/${instanceToken}/send-text`;
    const sendTextRes = await fetch(sendTextUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        phone: phone,
        message: `🚨 *PROTOCOLO EMERGÊNCIA* 🚨\n\nAdicionamos @${conciergePhone} para auxiliar sua unidade\n\n*De maneira direta, nos informe o ocorrido para que possamos auxiliar com mais rapidez.*`,
        mentioned: [conciergePhone],
        buttonList: {
          buttons: [
            {
              id: "emergencia_finalizar",
              label: "☑️ Encerrar emergência"
            }
          ]
        }
      }),
    });

    const sendTextData = await sendTextRes.json();
    console.log("✅ Mensagem de emergência enviada:", sendTextData);

    return new Response(JSON.stringify({ 
      success: true,
      chamado_id: chamado.id,
      concierge_adicionado: conciergeName,
      message: "Emergência ativada com sucesso"
    }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });

  } catch (err) {
    console.error("❌ Erro no emergencia_menu:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});