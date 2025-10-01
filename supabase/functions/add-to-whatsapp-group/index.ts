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

  async addParticipantToGroup(groupId: string, phone: string): Promise<ZAPIResponse> {
    if (!this.instanceId || !this.token || !this.clientToken) {
      console.error('Z-API credentials not configured');
      return { value: false, error: 'Z-API credentials not configured' };
    }

    try {
      console.log(`🔗 Adding participant ${phone} to group ${groupId}`);
      
      const response = await fetch(`${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/add-participant`, {
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
        console.error('Failed to add participant to Z-API group:', errorText);
        return { value: false, error: errorText };
      }

      const result = await response.json();
      console.log('✅ Participant added successfully via Z-API:', result);
      return result;
    } catch (error) {
      console.error('Error adding participant to Z-API group:', error);
      return { value: false, error: (error as any)?.message || 'Unknown error' };
    }
  }

  isConfigured(): boolean {
    return !!(this.instanceId && this.token && this.clientToken);
  }

  // Public getters for accessing private properties
  get baseUrlValue(): string {
    return this.baseUrl;
  }

  get instanceIdValue(): string {
    return this.instanceId;
  }

  get tokenValue(): string {
    return this.token;
  }

  get clientTokenValue(): string {
    return this.clientToken;
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

    console.log(`🎯 Processing chamado: ${chamadoId}`);

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

    // Buscar dados da unidade na tabela interna atendente_unidades
    const { data: atendente, error: atendenteError } = await supabase
      .from('atendente_unidades')
      .select('grupo, codigo_grupo, concierge_name, concierge_phone, unidade_id')
      .eq('unidade_id', chamado.unidade_id)
      .maybeSingle();

    if (atendenteError || !atendente) {
      console.error('❌ Atendente/Unidade not found in atendente_unidades:', atendenteError);
      return new Response(
        JSON.stringify({ error: 'Atendente/Unidade configuration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar id_grupo_branco na tabela externa unidades
    const { data: unidadeExternal, error: unidadeExternalError } = await externalSupabase
      .from('unidades')
      .select('id_grupo_branco')
      .eq('id', chamado.unidade_id)
      .maybeSingle();

    const id_grupo_branco = unidadeExternal?.id_grupo_branco || chamado.telefone;

    console.log(`🏢 Atendente/Unidade data:`, {
      concierge_name: atendente.concierge_name,
      concierge_phone: atendente.concierge_phone,
      grupo: atendente.grupo,
      id_grupo_branco: id_grupo_branco
    });

    // Determinar qual telefone adicionar ao grupo baseado no tipo de atendimento
    let phoneToAdd: string = '';
    let participantName: string = '';

    if (chamado.tipo_atendimento === 'concierge') {
      phoneToAdd = atendente.concierge_phone;
      participantName = atendente.concierge_name;
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

      phoneToAdd = dfcomConfig.setting_value;
      participantName = 'Equipe DFCom';
    }

    if (!phoneToAdd) {
      console.error('❌ No phone found for participant');
      return new Response(
        JSON.stringify({ error: 'No phone found for participant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar o id_grupo_branco como groupId
    const groupId = id_grupo_branco;

    console.log(`📞 Adding ${participantName} (${phoneToAdd}) to group ${groupId}`);

    // Adicionar participante ao grupo
    const result = await zapiClient.addParticipantToGroup(groupId, phoneToAdd);

    // Se a adição foi bem-sucedida, enviar mensagem de boas-vindas
    if (result.value) {
      console.log('✅ Participant added successfully');

      // Mensagem personalizada conforme tipo_atendimento
      let welcomeMessage = "";
      if (chamado.tipo_atendimento === "concierge") {
        welcomeMessage = `👋 Olá pessoal!\n\n${participantName} foi adicionado ao grupo e dará continuidade ao *atendimento Concierge*.\n\n⏳ Aguarde que ele assumirá sua solicitação em instantes.`;
      } else if (chamado.tipo_atendimento === "dfcom") {
        welcomeMessage = `⚫ *Atendimento DFCOM Iniciado*\n\n${participantName} entrou no grupo e dará sequência ao seu atendimento técnico.\n\n🔧 Por favor, aguarde as orientações da nossa equipe especializada.`;
      }

      try {
        const response = await fetch(
          `${zapiClient.baseUrlValue}/instances/${zapiClient.instanceIdValue}/token/${zapiClient.tokenValue}/send-text`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Client-Token": zapiClient.clientTokenValue,
            },
            body: JSON.stringify({
              phone: groupId,
              message: welcomeMessage,
            }),
          }
        );
        const msgResult = await response.json();
        console.log("📤 Mensagem de boas-vindas enviada:", msgResult);
      } catch (msgError) {
        console.error("❌ Erro ao enviar mensagem de boas-vindas:", msgError);
      }

      // Log da operação
      await supabase.from('logs_de_sistema').insert({
        tipo_log: 'sistema',
        entidade_afetada: 'chamados',
        entidade_id: chamadoId,
        acao_realizada: `Adição ao grupo WhatsApp - ${chamado.tipo_atendimento}`,
        usuario_responsavel: null,
        dados_novos: {
          group_id: groupId,
          participant_phone: phoneToAdd,
          participant_name: participantName,
          tipo_atendimento: chamado.tipo_atendimento,
          zapi_result: result,
          welcome_message_sent: true
        },
        canal: 'zapi'
      });

      return new Response(
        JSON.stringify({
          success: true,
          message: `${participantName} adicionado ao grupo com sucesso`,
          participant: participantName,
          phone: phoneToAdd,
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
      console.error("❌ Failed to add participant:", result.error);
      return new Response(
        JSON.stringify({
          error: "Failed to add participant to group",
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
      JSON.stringify({ error: 'Internal server error', details: (error as any)?.message || 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});