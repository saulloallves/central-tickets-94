import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from '../_shared/zapi-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdatePlanoInput {
  id: string;
  titulo?: string;
  categoria?: string;
  setor?: string;
  descricao?: string;
  acoes?: string;
  status?: string;
  prazo?: string;
  responsavel_local?: string;
  upload?: string;
}

interface UnidadeWhatsApp {
  id_grupo_branco: string;
  grupo: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('✏️ Iniciando atualização de plano de ação...');
    
    // Parse request body
    const body = await req.json();
    console.log('📦 Dados recebidos:', body);

    // Validate input
    if (!body.id) {
      throw new Error('Campo obrigatório: id');
    }

    const { id, ...updateData } = body;
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar plano atual para obter codigo_grupo
    console.log('🔍 Buscando plano atual...');
    const { data: planoAtual, error: fetchError } = await supabase
      .from('plano_acao')
      .select('codigo_grupo, codigo_plano')
      .eq('id', id)
      .single();

    if (fetchError || !planoAtual) {
      throw new Error('Plano de ação não encontrado');
    }

    // Update Plano de Ação - SEMPRE resetar status_frnq para 'aberto'
    console.log('💾 Atualizando plano de ação no banco...');
    const { data: plano, error: updateError } = await supabase
      .from('plano_acao')
      .update({
        ...updateData,
        status_frnq: 'aberto' // SEMPRE voltar para aberto após edição
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('❌ Erro ao atualizar plano:', updateError);
      throw new Error(`Erro ao atualizar plano de ação: ${updateError.message}`);
    }

    console.log('✅ Plano atualizado com sucesso! ID:', plano.id);

    // Get unidade information for WhatsApp notification
    let whatsappEnviado = false;
    
    if (planoAtual.codigo_grupo) {
      console.log('🔍 Buscando informações da unidade para código:', planoAtual.codigo_grupo);
      
      const { data: unidade, error: unidadeError } = await supabase
        .from('unidades_whatsapp')
        .select('id_grupo_branco, grupo')
        .eq('codigo_grupo', planoAtual.codigo_grupo)
        .maybeSingle();

      if (unidadeError) {
        console.error('⚠️ Erro ao buscar unidade:', unidadeError.message);
      } else if (!unidade) {
        console.log('⚠️ Unidade não encontrada para código:', planoAtual.codigo_grupo);
      } else if (!unidade.id_grupo_branco) {
        console.log('⚠️ Unidade encontrada mas sem id_grupo_branco');
      } else {
        console.log('✅ Unidade encontrada:', unidade.grupo);
        
        // Load message template
        const template = await loadMessageTemplate(supabase);
        
        // Send WhatsApp notification
        whatsappEnviado = await sendWhatsAppNotification(
          unidade as UnidadeWhatsApp,
          plano,
          template
        );
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Plano de ação atualizado com sucesso',
        plano_id: plano.id,
        codigo_plano: plano.codigo_plano,
        whatsapp_enviado: whatsappEnviado,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro geral:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro ao processar requisição'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});

async function loadMessageTemplate(supabase: any): Promise<string | null> {
  try {
    console.log('📄 Carregando template de mensagem...');
    const { data, error } = await supabase
      .from('message_templates')
      .select('template_content')
      .eq('template_key', 'plano_acao_atualizado')
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      console.log('⚠️ Template não encontrado no banco, usando padrão');
      return null;
    }

    console.log('✅ Template carregado do banco');
    return data.template_content;
  } catch (error) {
    console.error('❌ Erro ao carregar template:', error);
    return null;
  }
}

async function sendWhatsAppNotification(
  unidade: UnidadeWhatsApp,
  plano: any,
  template: string | null
): Promise<boolean> {
  try {
    console.log('📱 Preparando envio de notificação WhatsApp...');
    
    // Load Z-API configuration
    const zapiConfig = await loadZAPIConfig();
    
    if (!zapiConfig.instanceId || !zapiConfig.instanceToken) {
      console.error('⚠️ Configuração Z-API incompleta');
      return false;
    }

    // Build message
    const mensagem = buildMensagem(plano, unidade, template);
    console.log('📝 Mensagem construída:', mensagem);

    // Send via Z-API
    const url = `${zapiConfig.baseUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.instanceToken}/send-text`;
    
    console.log('🚀 Enviando para Z-API...');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': zapiConfig.clientToken || zapiConfig.instanceToken
      },
      body: JSON.stringify({
        phone: unidade.id_grupo_branco,
        message: mensagem
      })
    });

    const result = await response.json();
    
    if (!response.ok) {
      console.error('❌ Erro ao enviar WhatsApp:', result);
      return false;
    }

    console.log('✅ WhatsApp enviado com sucesso!', result);
    return true;

  } catch (error) {
    console.error('❌ Erro ao enviar notificação WhatsApp:', error);
    return false;
  }
}

function buildMensagem(plano: any, unidade: UnidadeWhatsApp, template?: string | null): string {
  // Template padrão (fallback)
  const defaultTemplate = `🔄 Plano de Ação Atualizado!

📋 Código: *{{codigo_plano}}*

📍 Unidade: Cresci e Perdi {{unidade_nome}}

🧩 Área: {{categoria}}

📅 Prazo: {{prazo}}

👤 Responsável local: {{responsavel_local}}

✏️ O plano foi atualizado e voltou ao status ABERTO.

Para visualizar as alterações, acesse:
👉 GiraBot.com > Plano de Ação`;

  const mensagemTemplate = template || defaultTemplate;

  // Formatar data para PT-BR (DD/MM/YYYY)
  const formatarData = (dataISO: string | null): string => {
    if (!dataISO) return 'Não definido';
    
    try {
      const data = new Date(dataISO);
      const dia = String(data.getDate()).padStart(2, '0');
      const mes = String(data.getMonth() + 1).padStart(2, '0');
      const ano = data.getFullYear();
      return `${dia}/${mes}/${ano}`;
    } catch {
      return dataISO;
    }
  };

  // Replace variables
  return mensagemTemplate
    .replace(/\{\{codigo_plano\}\}/g, plano.codigo_plano || 'N/A')
    .replace(/\{\{unidade_nome\}\}/g, unidade.grupo || 'N/A')
    .replace(/\{\{categoria\}\}/g, plano.categoria || 'Não especificada')
    .replace(/\{\{prazo\}\}/g, formatarData(plano.prazo))
    .replace(/\{\{responsavel_local\}\}/g, plano.responsavel_local || 'Não definido');
}
