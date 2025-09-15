import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    this.instanceId = Deno.env.get('ZAPI_INSTANCE_ID') || '';
    this.token = Deno.env.get('ZAPI_TOKEN') || '';
    this.clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
    this.baseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';
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
          phone: phone,
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

    // Determinar qual telefone adicionar ao grupo baseado no tipo de atendimento
    let phoneToAdd: string = '';
    let participantName: string = '';

    if (chamado.tipo_atendimento === 'concierge') {
      phoneToAdd = unidade.concierge_phone;
      participantName = unidade.concierge_name;
    } else if (chamado.tipo_atendimento === 'dfcom') {
      // Para DFCOM, usar o telefone do atendente (pode precisar de ajuste conforme a estrutura)
      phoneToAdd = chamado.atendente_id || ''; // Ajustar conforme necessário
      participantName = chamado.atendente_nome || 'Atendente DFCOM';
    }

    if (!phoneToAdd) {
      console.error('❌ No phone found for participant');
      return new Response(
        JSON.stringify({ error: 'No phone found for participant' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar o id_grupo_branco da unidade como groupId (se não tiver, usar telefone do chamado)
    const groupId = unidade.id_grupo_branco || chamado.telefone;

    console.log(`📞 Adding ${participantName} (${phoneToAdd}) to group ${groupId}`);

    // Adicionar participante ao grupo
    const result = await zapiClient.addParticipantToGroup(groupId, phoneToAdd);

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
        zapi_result: result
      },
      canal: 'zapi'
    });

    if (result.value) {
      console.log('✅ Participant added successfully');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `${participantName} adicionado ao grupo com sucesso`,
          participant: participantName,
          phone: phoneToAdd,
          group: groupId
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      console.error('❌ Failed to add participant:', result.error);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to add participant to group',
          details: result.error || result.message
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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