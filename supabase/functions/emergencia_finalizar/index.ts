import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from "../_shared/zapi-config.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
      
      // Tentar primeiro sem o sufixo @s.whatsapp.net
      let response = await fetch(`${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/remove-participant`, {
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
        console.warn(`⚠️ First attempt failed (without suffix): ${errorText}`);
        
        // Se falhou, tentar com o sufixo @s.whatsapp.net
        const phoneWithSuffix = phone.includes('@') ? phone : `${phone}@s.whatsapp.net`;
        console.log(`🔄 Trying again with suffix: ${phoneWithSuffix}`);
        
        response = await fetch(`${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/remove-participant`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Client-Token': this.clientToken,
          },
          body: JSON.stringify({
            groupId: groupId,
            phones: [phoneWithSuffix],
          }),
        });
        
        if (!response.ok) {
          const errorText2 = await response.text();
          console.error('Failed to remove participant from Z-API group (both attempts):', errorText2);
          return { value: false, error: errorText2 };
        }
      }

      const result = await response.json();
      console.log('✅ Participant removed successfully via Z-API:', result);
      return result;
    } catch (error) {
      console.error('Error removing participant from Z-API group:', error);
      return { value: false, error: error.message };
    }
  }

  async sendText(phone: string, message: string): Promise<ZAPIResponse> {
    if (!this.instanceId || !this.token || !this.clientToken) {
      console.error('Z-API credentials not configured');
      return { value: false, error: 'Z-API credentials not configured' };
    }

    try {
      console.log(`💬 Sending text to ${phone}`);
      
      const response = await fetch(`${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/send-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify({
          phone: phone,
          message: message,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to send text via Z-API:', errorText);
        return { value: false, error: errorText };
      }

      const result = await response.json();
      console.log('✅ Text sent successfully via Z-API:', result);
      return result;
    } catch (error) {
      console.error('Error sending text via Z-API:', error);
      return { value: false, error: error.message };
    }
  }

  isConfigured(): boolean {
    return !!(this.instanceId && this.token && this.clientToken);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const externalSupabase = createClient(
      Deno.env.get("EXTERNAL_SUPABASE_URL") ?? '',
      Deno.env.get("EXTERNAL_SUPABASE_SERVICE_KEY") ?? ''
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

    const body = await req.json();
    const phone = body?.phone;
    
    if (!phone) {
      return new Response(JSON.stringify({ error: "Telefone não encontrado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 400,
      });
    }

    console.log(`☑️ Finalizando emergência do grupo: ${phone}`);

    // Buscar chamado de emergência ativo deste grupo
    const { data: chamado, error: chamadoError } = await supabase
      .from('chamados')
      .select('*')
      .eq('telefone', phone)
      .eq('is_emergencia', true)
      .in('status', ['emergencia', 'em_atendimento', 'em_fila'])
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (chamadoError || !chamado) {
      console.error("❌ Chamado de emergência não encontrado:", chamadoError);
      return new Response(JSON.stringify({ 
        error: "Chamado de emergência não encontrado",
        telefone: phone,
        details: chamadoError?.message
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }

    console.log(`✅ Chamado encontrado: ${chamado.id}`);

    // Buscar unidade pelo código do grupo
    const { data: unidade } = await externalSupabase
      .from('unidades')
      .select('id, concierge_phone')
      .eq('id_grupo_branco', phone)
      .maybeSingle();

    if (!unidade?.concierge_phone) {
      console.error("❌ Telefone do concierge não encontrado para a unidade");
      return new Response(JSON.stringify({ 
        error: "Telefone do concierge não configurado" 
      }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 404,
      });
    }

    console.log(`📞 Concierge phone (raw): ${unidade.concierge_phone}`);

    // Formatar telefone do concierge
    let conciergePhone = String(unidade.concierge_phone).trim();
    
    // Remover caracteres especiais e espaços
    conciergePhone = conciergePhone.replace(/\D/g, '');
    
    // Adicionar o prefixo do país se não tiver (Brasil = 55)
    if (!conciergePhone.startsWith('55') && conciergePhone.length === 11) {
      conciergePhone = '55' + conciergePhone;
    }
    
    console.log(`📞 Concierge phone (formatted): ${conciergePhone}`);

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

    // Buscar números de emergência que podem ter sido adicionados
    const { data: settingsData } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'emergency_numbers')
      .maybeSingle();

    let emergencyNumbers = [];
    if (settingsData?.setting_value) {
      try {
        emergencyNumbers = JSON.parse(settingsData.setting_value);
        console.log(`📋 ${emergencyNumbers.length} números de emergência para remover`);
      } catch (e) {
        console.error('❌ Erro ao parsear números de emergência:', e);
      }
    }

    // Aguardar um pouco para garantir que o banco atualizou
    await new Promise(resolve => setTimeout(resolve, 500));

    // Remover todos os participantes adicionados (concierge + números de emergência)
    const phonesToRemove = [conciergePhone];
    
    if (emergencyNumbers.length > 0) {
      phonesToRemove.push(...emergencyNumbers.map((num: any) => num.phone));
    }

    console.log(`🔄 Tentando remover ${phonesToRemove.length} participantes do grupo ${phone}`);
    
    let allRemoved = true;
    const removeErrors = [];

    for (const phoneToRemove of phonesToRemove) {
      const removeResult = await zapiClient.removeParticipantFromGroup(phone, phoneToRemove);
      if (!removeResult.value) {
        console.error(`❌ Falha ao remover ${phoneToRemove}:`, removeResult.error);
        allRemoved = false;
        removeErrors.push({ phone: phoneToRemove, error: removeResult.error });
      } else {
        console.log(`✅ ${phoneToRemove} removido com sucesso`);
      }
    }

    if (!allRemoved) {
      console.warn("⚠️ Alguns participantes não foram removidos:", removeErrors);
    }

    console.log("✅ Processo de remoção concluído");

    // Enviar mensagem de confirmação
    const confirmMessage = "✅ *EMERGÊNCIA ENCERRADA*\n\nO protocolo de emergência foi finalizado com sucesso.\n\nObrigado por utilizar nossos serviços! 🙏";
    const sendResult = await zapiClient.sendText(phone, confirmMessage);

    if (!sendResult.value) {
      console.warn("⚠️ Falha ao enviar mensagem de confirmação:", sendResult.error);
    } else {
      console.log(`✅ Mensagem de confirmação enviada`);
    }

    // Log da operação
    await supabase.from('logs_de_sistema').insert({
      tipo_log: 'sistema',
      entidade_afetada: 'chamados',
      entidade_id: chamado.id,
      acao_realizada: 'Emergência finalizada - Concierge removido do grupo',
      usuario_responsavel: null,
      dados_novos: {
        group_id: phone,
        concierge_phone: unidade.concierge_phone,
        zapi_result: removeResult,
        confirmation_sent: sendResult.value
      },
      canal: 'zapi'
    });

    return new Response(JSON.stringify({ 
      success: true,
      chamado_id: chamado.id,
      message: "Emergência finalizada com sucesso",
      concierge_removed: removeResult.value,
      confirmation_sent: sendResult.value
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
