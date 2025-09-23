import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ZAPIResponse {
  value: boolean;
  message?: string;
  error?: string;
}

class ZAPIClient {
  private instanceId: string;
  private token: string;
  private clientToken: string;
  private baseUrl: string;

  constructor() {
    // As configurações serão carregadas dinamicamente
    this.instanceId = '';
    this.token = '';
    this.clientToken = '';
    this.baseUrl = '';
  }

  async loadConfig() {
    const config = await loadZAPIConfig();
    this.instanceId = config.instanceId || '';
    this.token = config.instanceToken || '';
    this.clientToken = config.clientToken || '';
    this.baseUrl = config.baseUrl || '';
  }

  async removeParticipantFromGroup(groupId: string, phone: string): Promise<ZAPIResponse> {
    if (!this.instanceId || !this.token || !this.clientToken) {
      console.error('Z-API credentials not configured');
      return { value: false, error: 'Z-API credentials not configured' };
    }

    try {
      console.log(`🔗 Removing participant ${phone} from group ${groupId}`);
      
      const response = await fetch(`${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/remove-participant`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          groupId: groupId,
          phones: [phone],
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to remove participant from Z-API group:', errorText);
        return { value: false, error: errorText };
      }

      const result = await response.json();
      console.log('✅ Participant removed successfully via Z-API:', result);
      return result;
    } catch (error) {
      console.error('Error removing participant from Z-API group:', error);
      return { value: false, error: error.message };
    }
  }

  isConfigured(): boolean {
    return !!(this.instanceId && this.token && this.clientToken);
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const externalSupabase = createClient(
      Deno.env.get('EXTERNAL_SUPABASE_URL') ?? '',
      Deno.env.get('EXTERNAL_SUPABASE_SERVICE_KEY') ?? ''
    );

    const zapiClient = new ZAPIClient();
    await zapiClient.loadConfig();

    if (!zapiClient.isConfigured()) {
      console.error('❌ Z-API not configured');
      return new Response(
        JSON.stringify({ error: 'Z-API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { chamadoId } = await req.json();

    if (!chamadoId) {
      return new Response(
        JSON.stringify({ error: 'chamadoId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🎯 Processing chamado removal: ${chamadoId}`);

    // Buscar dados do chamado
    const { data: chamado, error: chamadoError } = await supabase
      .from('chamados')
      .select('*')
      .eq('id', chamadoId)
      .single();

    if (chamadoError || !chamado) {
      console.error('❌ Chamado not found:', chamadoError);
      return new Response(
        JSON.stringify({ error: 'Chamado not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📋 Chamado data:`, {
      id: chamado.id,
      tipo_atendimento: chamado.tipo_atendimento,
      unidade_id: chamado.unidade_id,
      telefone: chamado.telefone,
      atendente_nome: chamado.atendente_nome
    });

    // Buscar dados da unidade na tabela externa para pegar concierge_phone e id_grupo_branco
    const { data: unidade, error: unidadeError } = await externalSupabase
      .from('unidades')
      .select('id, grupo, concierge_name, concierge_phone, id_grupo_branco')
      .eq('id', chamado.unidade_id)
      .single();

    if (unidadeError || !unidade) {
      console.error('❌ Unidade not found:', unidadeError);
      return new Response(
        JSON.stringify({ error: 'Unidade not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🏢 Unidade data:`, {
      id: unidade.id,
      concierge_name: unidade.concierge_name,
      concierge_phone: unidade.concierge_phone,
      id_grupo_branco: unidade.id_grupo_branco
    });

    // Determinar qual telefone remover do grupo baseado no tipo de atendimento
    let phoneToRemove: string = '';
    let participantName: string = '';

    if (chamado.tipo_atendimento === 'concierge') {
      phoneToRemove = unidade.concierge_phone;
      participantName = unidade.concierge_name;
    } else if (chamado.tipo_atendimento === 'dfcom') {
      // Para DFCOM, usar o número fixo configurado no sistema
      const { data: dfcomConfig, error: configError } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'dfcom_phone_number')
        .single();

      if (configError || !dfcomConfig) {
        console.error('❌ DFCOM phone config not found:', configError);
        return new Response(
          JSON.stringify({ error: 'DFCOM phone configuration not found' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      phoneToRemove = dfcomConfig.setting_value;
      participantName = 'Equipe DFCom';
    }

    if (!phoneToRemove) {
      console.error('❌ No phone found for participant removal');
      return new Response(
        JSON.stringify({ error: 'No phone found for participant removal' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar o id_grupo_branco da unidade como groupId (se não tiver, usar telefone do chamado)
    const groupId = unidade.id_grupo_branco || chamado.telefone;

    console.log(`📞 Removing ${participantName} (${phoneToRemove}) from group ${groupId}`);

    // Remover participante do grupo
    const result = await zapiClient.removeParticipantFromGroup(groupId, phoneToRemove);

    // Se a remoção foi bem-sucedida, enviar mensagem de despedida
    if (result.value) {
      console.log('✅ Participant removed successfully');

      // Mensagem personalizada conforme tipo_atendimento
      let farewellMessage = "";
      if (chamado.tipo_atendimento === "concierge") {
        farewellMessage = `👋 *Atendimento Concierge Finalizado*\n\n${participantName} finalizou o atendimento.\n\n✅ Obrigado pela preferência!`;
      } else if (chamado.tipo_atendimento === "dfcom") {
        farewellMessage = `⚫ *Atendimento DFCOM Finalizado*\n\n${participantName} finalizou o atendimento técnico.\n\n✅ Obrigado pela confiança em nossa equipe!`;
      }

      try {
        const response = await fetch(
          `${zapiClient.baseUrl}/instances/${zapiClient.instanceId}/token/${zapiClient.token}/send-text`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": zapiClient.clientToken,
            },
            body: JSON.stringify({
              phone: groupId,
              message: farewellMessage,
            }),
          }
        );
        const msgResult = await response.json();
        console.log("📤 Mensagem de despedida enviada:", msgResult);
      } catch (msgError) {
        console.error("❌ Erro ao enviar mensagem de despedida:", msgError);
      }

      // Log da operação
      await supabase.from('logs_de_sistema').insert({
        tipo_log: 'sistema',
        entidade_afetada: 'chamados',
        entidade_id: chamadoId,
        acao_realizada: `Remoção do grupo WhatsApp - ${chamado.tipo_atendimento}`,
        usuario_responsavel: null,
        dados_novos: {
          group_id: groupId,
          participant_phone: phoneToRemove,
          participant_name: participantName,
          tipo_atendimento: chamado.tipo_atendimento,
          zapi_result: result,
          farewell_message_sent: true
        },
        canal: 'zapi'
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `${participantName} removido do grupo com sucesso`,
          participant: participantName,
          phone: phoneToRemove,
          group: groupId,
        }),
        {
          status: 200,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    } else {
      console.error("❌ Failed to remove participant:", result.error);
      return new Response(
        JSON.stringify({
          error: "Failed to remove participant from group",
          details: result.error || result.message,
        }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});