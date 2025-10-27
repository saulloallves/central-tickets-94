import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { loadZAPIConfig } from '../_shared/zapi-config.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlanoAcaoInput {
  codigo_grupo: string;
  nome_completo?: string;
  setor?: string;
  categoria?: string;
  descricao?: string;
  acoes?: string;
  status?: string;
  prazo?: string;
  responsavel_local?: string;
  upload?: string;
  gpt?: string;
  titulo?: string;
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
    console.log('📝 Iniciando criação de plano de ação...');
    
    // Parse request body
    const body = await req.json();
    console.log('📦 Dados recebidos:', body);

    // Validate input
    const planoData = validateInput(body);
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Gerar código sequencial
    console.log('🔢 Gerando código do plano...');
    const codigoPlano = await gerarCodigoPlano(supabase, planoData.codigo_grupo);

    // Create Plano de Ação
    console.log('💾 Criando plano de ação no banco...');
    const { data: plano, error: planoError } = await supabase
      .from('plano_acao')
      .insert({
        ...planoData,
        codigo_plano: codigoPlano,
        status_frnq: 'aberto'
      })
      .select()
      .single();

    if (planoError) {
      console.error('❌ Erro ao criar plano:', planoError);
      throw new Error(`Erro ao criar plano de ação: ${planoError.message}`);
    }

    console.log('✅ Plano criado com sucesso! ID:', plano.id);

    // Get unidade information for WhatsApp notification
    let whatsappEnviado = false;
    
    if (planoData.codigo_grupo) {
      console.log('🔍 Buscando informações da unidade para código:', planoData.codigo_grupo);
      
      const { data: unidade, error: unidadeError } = await supabase
        .from('unidades_whatsapp')
        .select('id_grupo_branco, grupo')
        .eq('codigo_grupo', planoData.codigo_grupo)
        .maybeSingle();

      if (unidadeError) {
        console.error('⚠️ Erro ao buscar unidade:', unidadeError.message);
      } else if (!unidade) {
        console.log('⚠️ Unidade não encontrada para código:', planoData.codigo_grupo);
      } else if (!unidade.id_grupo_branco) {
        console.log('⚠️ Unidade encontrada mas sem id_grupo_branco');
      } else {
        console.log('✅ Unidade encontrada:', unidade.grupo);
        
        // Send WhatsApp notification
        whatsappEnviado = await sendWhatsAppNotification(
          unidade as UnidadeWhatsApp,
          plano
        );
      }
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        message: 'Plano de ação criado com sucesso',
        plano_id: plano.id,
        codigo_plano: plano.codigo_plano,
        whatsapp_enviado: whatsappEnviado,
        resposta: 'Plano de ação Enviado'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 201
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

function validateInput(data: any): PlanoAcaoInput {
  if (!data.codigo_grupo) {
    throw new Error('Campo obrigatório: codigo_grupo');
  }

  return {
    codigo_grupo: String(data.codigo_grupo),
    nome_completo: data.nome_completo || null,
    setor: data.setor || null,
    categoria: data.categoria || null,
    descricao: data.descricao || null,
    acoes: data.acoes || null,
    status: data.status || null,
    prazo: data.prazo || null,
    responsavel_local: data.responsavel_local || null,
    upload: data.upload || null,
    gpt: data.gpt || null,
    titulo: data.titulo || null
  };
}

async function gerarCodigoPlano(
  supabase: any,
  codigoGrupo: string
): Promise<string> {
  console.log('🔍 Buscando último código para unidade:', codigoGrupo);
  
  // Buscar o último código da unidade
  const { data: ultimoPlano, error } = await supabase
    .from('plano_acao')
    .select('codigo_plano')
    .eq('codigo_grupo', codigoGrupo)
    .not('codigo_plano', 'is', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let proximoSequencial = 1;

  if (!error && ultimoPlano?.codigo_plano) {
    console.log('📋 Último código encontrado:', ultimoPlano.codigo_plano);
    // Extrair o sequencial do código (PA-1659-0012 → 0012)
    const match = ultimoPlano.codigo_plano.match(/PA-\d+-(\d+)$/);
    if (match) {
      proximoSequencial = parseInt(match[1], 10) + 1;
    }
  } else {
    console.log('📋 Nenhum código anterior, iniciando em 0001');
  }

  // Formatar com 4 dígitos: 0001, 0002, etc
  const sequencialFormatado = proximoSequencial.toString().padStart(4, '0');
  const codigoPlano = `PA-${codigoGrupo}-${sequencialFormatado}`;
  
  console.log('✅ Código gerado:', codigoPlano);
  return codigoPlano;
}

async function sendWhatsAppNotification(
  unidade: UnidadeWhatsApp,
  plano: any
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
    const mensagem = buildMensagem(plano, unidade);
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

function buildMensagem(plano: any, unidade: UnidadeWhatsApp): string {
  return `⚙️ Novo Plano de Ação Operacional Registrado!

📋 Código: *${plano.codigo_plano}*

📍 Unidade: Cresci e Perdi ${unidade.grupo}

🧩 Área: ${plano.categoria || 'Não especificada'}

📅 Prazo: ${plano.prazo || 'Não definido'}

👤 Responsável local: ${plano.responsavel_local || 'Não definido'}

Para visualizar e confirmar o andamento, acesse:
👉 GiraBot.com > Plano de Ação`;
}
