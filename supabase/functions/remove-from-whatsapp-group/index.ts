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

  async sendButtonList(phone: string, message: string, buttons: Array<{id: string, label: string}>): Promise<ZAPIResponse> {
    if (!this.instanceId || !this.token || !this.clientToken) {
      console.error('Z-API credentials not configured');
      return { value: false, error: 'Z-API credentials not configured' };
    }

    try {
      console.log(`📋 Sending button list to ${phone}`);
      
      const response = await fetch(`${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-button-list`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone: phone,
          message: message,
          buttonList: {
            buttons: buttons
          }
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send button list via Z-API:', errorText);
        return { value: false, error: errorText };
      }

      const result = await response.json();
      console.log('✅ Button list sent successfully via Z-API:', result);
      return result;
    } catch (error) {
      console.error('Error sending button list via Z-API:', error);
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

    // Buscar dados da unidade e atendente_id na tabela interna atendente_unidades
    const { data: atendenteUnidade, error: atendenteUnidadeError } = await supabase
      .from('atendente_unidades')
      .select('grupo, codigo_grupo, atendente_id')
      .eq('codigo_grupo', chamado.unidade_id)
      .maybeSingle();

    if (atendenteUnidadeError || !atendenteUnidade) {
      console.error('❌ Atendente/Unidade not found in atendente_unidades:', atendenteUnidadeError);
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
      atendente_id: atendenteUnidade.atendente_id,
      codigo_grupo: atendenteUnidade.codigo_grupo,
      grupo: atendenteUnidade.grupo,
      id_grupo_branco: id_grupo_branco
    });

    // Determinar qual telefone remover do grupo baseado no tipo de atendimento
    let phoneToRemove: string = '';
    let participantName: string = '';

    if (chamado.tipo_atendimento === 'concierge') {
      // Para Concierge, buscar da tabela atendentes usando atendente_id
      console.log('🔍 Buscando Concierge da tabela atendentes...');
      const { data: conciergeAtendente, error: conciergeError } = await supabase
        .from('atendentes')
        .select('nome, telefone')
        .eq('id', atendenteUnidade.atendente_id)
        .eq('tipo', 'concierge')
        .eq('ativo', true)
        .maybeSingle();

      if (conciergeError || !conciergeAtendente?.telefone) {
        console.error('❌ Concierge não encontrado na tabela atendentes:', conciergeError);
        return new Response(
          JSON.stringify({ error: 'Concierge configuration not found' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      phoneToRemove = conciergeAtendente.telefone;
      participantName = conciergeAtendente.nome || 'Concierge';
      console.log('✅ Concierge encontrado na tabela atendentes:', participantName, phoneToRemove);
    } else if (chamado.tipo_atendimento === 'dfcom') {
      // Para DFCOM, buscar da tabela atendentes (DFCom global único)
      console.log('🔍 Buscando DFCom global da tabela atendentes...');
      const { data: dfcomAtendente, error: dfcomError } = await supabase
        .from('atendentes')
        .select('nome, telefone')
        .eq('tipo', 'dfcom')
        .eq('ativo', true)
        .maybeSingle();

      if (dfcomError || !dfcomAtendente?.telefone) {
        console.warn('⚠️ DFCom não encontrado na tabela atendentes, tentando fallback para system_settings');
        // Fallback para system_settings (compatibilidade)
        const { data: dfcomConfig, error: configError } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'dfcom_phone_number')
          .maybeSingle();

        if (configError || !dfcomConfig) {
          console.error('❌ DFCOM não configurado nem na tabela atendentes nem em system_settings:', configError);
          return new Response(
            JSON.stringify({ error: 'DFCOM phone configuration not found' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        phoneToRemove = dfcomConfig.setting_value;
        participantName = 'Equipe DFCom';
      } else {
        phoneToRemove = dfcomAtendente.telefone;
        participantName = dfcomAtendente.nome || 'Equipe DFCom';
        console.log('✅ DFCom encontrado na tabela atendentes:', participantName, phoneToRemove);
      }
    }

    if (!phoneToRemove) {
      console.error('❌ No phone found for participant removal');
      return new Response(
        JSON.stringify({ error: 'No phone found for participant removal' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Usar o id_grupo_branco como groupId
    const groupId = id_grupo_branco;

    console.log(`📞 Removing ${participantName} (${phoneToRemove}) from group ${groupId}`);

    // Remover participante do grupo
    const result = await zapiClient.removeParticipantFromGroup(groupId, phoneToRemove);

    // Se a remoção foi bem-sucedida, enviar mensagem de avaliação
    if (result.value) {
      console.log('✅ Participant removed successfully');
      
      // Enviar mensagem de avaliação usando telefone do chamado
      const phoneDestino = chamado.telefone;
      console.log(`📋 Enviando mensagem de avaliação para: ${phoneDestino}`);
      
      const evaluationMessage = "✅ *Atendimento finalizado*\n\n🗣️ Como você avalia esse atendimento?";
      const evaluationButtons = [
        {
          id: `avaliacao_otimo_${chamado.id}`,
          label: "🌟 Consegui resolver tudo"
        },
        {
          id: `avaliacao_bom_${chamado.id}`,
          label: "🙂 Foi útil, mas poderia melhorar"
        },
        {
          id: `avaliacao_ruim_${chamado.id}`,
          label: "😕 Não resolveu o que eu precisava"
        }
      ];

      const evaluationResult = await zapiClient.sendButtonList(phoneDestino, evaluationMessage, evaluationButtons);
      
      if (evaluationResult.value) {
        console.log('✅ Evaluation message sent successfully');
        
        // Salvar registro na tabela de avaliações com todas as informações da unidade
        const { error: avaliacaoError } = await supabase
          .from('avaliacoes_atendimento')
          .insert({
            chamado_id: chamado.id,
            telefone_destino: phoneDestino,
            enviado_em: new Date().toISOString(),
            tipo_atendimento: chamado.tipo_atendimento,
            unidade_nome: atendenteUnidade.grupo || `Unidade ${atendenteUnidade.codigo_grupo}`,
            unidade_codigo: atendenteUnidade.codigo_grupo?.toString(),
            grupo_whatsapp_id: id_grupo_branco
          });

        if (avaliacaoError) {
          console.error('❌ Error saving evaluation record:', avaliacaoError);
        } else {
          console.log('📝 Evaluation record saved successfully');
        }
      } else {
        console.error('❌ Failed to send evaluation message:', evaluationResult.error);
      }
      
      console.log(`📤 ${participantName} removido do grupo com sucesso. Mensagem de avaliação enviada.`);

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
          evaluation_sent: evaluationResult.value,
          evaluation_phone: phoneDestino
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
          evaluation_sent: evaluationResult.value,
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