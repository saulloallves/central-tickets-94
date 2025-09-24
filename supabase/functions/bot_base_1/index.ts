import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cliente Supabase para buscar configurações
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_ANON_KEY') ?? ''
)

// Cliente Supabase para verificar grupos permitidos na tabela unidades
const unidadesSupabase = createClient(
  'https://liovmltalaicwrixigjb.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxpb3ZtbHRhbGFpY3dyaXhpZ2piIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzMwNTI1MSwiZXhwIjoyMDY4ODgxMjUxfQ.vt2jHKJc-tBh-DQ222YnEI6DfurenC8DQID8jovrstI'
)

// Configuração Z-API específica para BOT
class BotZAPIClient {
  private instanceId: string;
  private token: string;
  private clientToken: string;
  private baseUrl: string;

  constructor() {
    this.instanceId = '';
    this.token = '';
    this.clientToken = '';
    this.baseUrl = 'https://api.z-api.io';
  }

  async loadConfig() {
    console.log('🔧 Carregando configuração do bot...');
    
    // Primeiro, tenta buscar da configuração do banco
    try {
      const { data: config, error } = await supabase
        .from('messaging_providers')
        .select('instance_id, instance_token, client_token, base_url')
        .eq('provider_name', 'zapi_bot')
        .eq('is_active', true)
        .maybeSingle();

      if (!error && config && config.instance_id) {
        console.log('✅ Configuração encontrada no banco:', config.instance_id?.substring(0, 8) + '...');
        this.instanceId = config.instance_id;
        this.token = config.instance_token;
        this.clientToken = config.client_token;
        this.baseUrl = config.base_url || 'https://api.z-api.io';
        return;
      } else {
        console.log('⚠️ Configuração não encontrada no banco, usando env vars:', error?.message || 'Config não encontrada');
      }
    } catch (error) {
      console.error('❌ Erro ao buscar configuração no banco:', error);
    }

    // Fallback para variáveis de ambiente
    this.instanceId = Deno.env.get('BOT_ZAPI_INSTANCE_ID') || Deno.env.get('ZAPI_INSTANCE_ID') || '';
    this.token = Deno.env.get('BOT_ZAPI_TOKEN') || Deno.env.get('ZAPI_TOKEN') || '';
    this.clientToken = Deno.env.get('BOT_ZAPI_CLIENT_TOKEN') || Deno.env.get('ZAPI_CLIENT_TOKEN') || '';
    this.baseUrl = Deno.env.get('BOT_ZAPI_BASE_URL') || Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';
    
    console.log('📝 Usando configuração das env vars:', this.instanceId?.substring(0, 8) + '...');
  }

  async sendMessage(phone: string, message: string, buttons?: any[]): Promise<boolean> {
    if (!this.instanceId || !this.token || !this.clientToken) {
      console.error('BOT Z-API credentials not configured');
      return false;
    }

    try {
      let endpoint = 'send-text';
      let body: any = {
        phone: phone,
        message: message
      };

      if (buttons && buttons.length > 0) {
        endpoint = 'send-button-list';
        body.buttonList = { buttons };
      }

      const response = await fetch(`${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': this.clientToken,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error('Failed to send BOT Z-API message:', await response.text());
        return false;
      }

      console.log('✅ BOT message sent successfully via Z-API');
      return true;
    } catch (error) {
      console.error('Error sending BOT Z-API message:', error);
      return false;
    }
  }

  isConfigured(): boolean {
    return !!(this.instanceId && this.token && this.clientToken);
  }
}

const botZapi = new BotZAPIClient();

// Função para verificar se o grupo está autorizado na tabela unidades
async function checkGroupInDatabase(groupId: string): Promise<boolean> {
  try {
    console.log(`🔍 Verificando grupo ${groupId} na tabela unidades...`);
    
    const { data, error } = await unidadesSupabase
      .from('unidades')
      .select('id, id_grupo_branco')
      .eq('id_grupo_branco', groupId)
      .maybeSingle();

    if (error) {
      console.error('❌ Erro ao consultar tabela unidades:', error);
      return false;
    }

    if (data) {
      console.log(`✅ Grupo ${groupId} encontrado na tabela unidades:`, data.id);
      return true;
    } else {
      console.log(`🚫 Grupo ${groupId} NÃO encontrado na tabela unidades`);
      return false;
    }
  } catch (error) {
    console.error('❌ Erro na verificação de grupo:', error);
    return false;
  }
}

// Função para enviar notificação de grupo não autorizado
async function sendUnauthorizedGroupNotification(groupId: string) {
  try {
    console.log(`📢 Enviando notificação para grupo não autorizado: ${groupId}`);
    
    const notificationBody = {
      title: "🚫 Grupo não autorizado tentou usar o bot",
      message: `O grupo ${groupId} tentou usar o bot_base_1 mas não está cadastrado na tabela unidades`,
      type: "alert",
      payload: {
        group_id: groupId,
        timestamp: new Date().toISOString(),
        function: "bot_base_1"
      }
    };

    const response = await supabase.functions.invoke('create-internal-notification', {
      body: notificationBody
    });

    if (response.error) {
      console.error('❌ Erro ao enviar notificação:', response.error);
    } else {
      console.log('✅ Notificação enviada com sucesso:', response.data);
    }
  } catch (error) {
    console.error('❌ Erro ao enviar notificação de grupo não autorizado:', error);
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Carrega configuração do banco primeiro
  console.log("🔧 Carregando configuração do bot...");
  await botZapi.loadConfig();
  console.log("✅ Configuração carregada, bot está configurado:", botZapi.isConfigured());

  try {
    console.log("🚀 BOT_BASE_1 INICIADO - Recebendo requisição");
    console.log("🌍 Request URL:", req.url);
    console.log("📝 Request method:", req.method);
    
    const body = await req.json();
    console.log("📦 Body parseado:", JSON.stringify(body, null, 2));

    // Tenta extrair buttonId de várias formas possíveis
    const buttonId1 = body?.buttonsResponseMessage?.buttonId;
    const buttonId2 = body?.buttonId;
    const buttonId3 = body?.button?.id;
    const buttonId4 = body?.selectedButtonId;
    
    const buttonId = buttonId1 || buttonId2 || buttonId3 || buttonId4 || "";
    
    // Extrai phone e message 
    const phone = body?.phone || body?.participantPhone;
    const message = (body?.text?.message || body?.message || "").toLowerCase();

    console.log("🔍 DADOS EXTRAÍDOS:");
    console.log("Phone:", phone);
    console.log("ButtonId:", buttonId);
    console.log("Message:", message);
    
    const isGroup = body?.isGroup;
    const chatId = body?.phone;

    // Palavras-chave que disparam menu inicial
    const KEYWORDS = ["menu", "ola robo", "olá robô", "abacate"];

    const functionsBaseUrl =
      Deno.env.get("FUNCTIONS_BASE_URL") ||
      `https://hryurntaljdisohawpqf.supabase.co/functions/v1`;

    // 🔹 MENU INICIAL - Verificação com debug
    console.log("🔍 Verificando keywords:", KEYWORDS);
    console.log("🔍 Message para verificar:", `"${message}"`);
    const keywordMatch = KEYWORDS.some((k) => message.includes(k.toLowerCase()));
    console.log("🔍 Keyword match encontrado:", keywordMatch);
    
    if (keywordMatch) {
      // FILTRO DINÂMICO: Verificar grupos na tabela unidades APENAS quando usar palavras-chave
      if (isGroup) {
        const isAuthorized = await checkGroupInDatabase(chatId);
        
        if (!isAuthorized) {
          console.log(`🚫 BOT_BASE_1: Grupo não autorizado (${chatId})`);
          
          // Enviar notificação para admins
          await sendUnauthorizedGroupNotification(chatId);
          
          return new Response(JSON.stringify({ 
            success: false, 
            message: "Bot only processes messages from authorized groups" 
          }), {
            headers: { "Content-Type": "application/json", ...corsHeaders },
            status: 403
          });
        }
        
        console.log("✅ BOT_BASE_1: Grupo autorizado - prosseguindo para menu");
      } else {
        console.log("📱 BOT_BASE_1: Mensagem privada - prosseguindo para menu");
      }
      
      console.log("📞 Chamando menu_principal...");
      const res = await fetch(`${functionsBaseUrl}/menu_principal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify(body),
      });
      
      const responseText = await res.text();
      console.log("📤 Resposta do menu_principal:", responseText);
      
      return new Response(responseText, {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: res.status,
      });
    }

    // 🔹 AUTOATENDIMENTO (Menu principal)
    if (buttonId === "autoatendimento_menu") {
      const res = await fetch(`${functionsBaseUrl}/autoatendimento`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify(body),
      });
      return new Response(await res.text(), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: res.status,
      });
    }

    // 🔹 SUBMENUS DO AUTOATENDIMENTO
    
    // Calendário
    if (buttonId === "autoatendimento_calendario") {
      return await proxy(functionsBaseUrl, "autoatendimento_calendario", body);
    }
    if (buttonId === "autoatendimento_midias") {
      console.log("🖼️ MATCH! REDIRECIONANDO PARA autoatendimento_midias");
      return await proxy(functionsBaseUrl, "autoatendimento_midias", body);
    }
    if (buttonId === "autoatendimento_ticket") {
      return await proxy(functionsBaseUrl, "autoatendimento_ticket", body);
    }
    if (buttonId === "autoatendimento_nao_sei_senha") {
      return await proxy(functionsBaseUrl, "autoatendimento_nao_sei_senha", body);
    }
    if (buttonId === "autoatendimento_ouvidoria") {
      return await proxy(functionsBaseUrl, "autoatendimento_ouvidoria", body);
    }
    if (buttonId === "autoatendimento_manuais") {
      return await proxy(functionsBaseUrl, "autoatendimento_manuais", body);
    }
    if (buttonId === "outras_opcoes") {
      return await proxy(functionsBaseUrl, "outras_opcoes", body);
    }

    // 🔹 NOVOS MENUS PRINCIPAIS
    if (buttonId === "personalizado_menu") {
      return await proxy(functionsBaseUrl, "personalizado_menu", body);
    }
    if (buttonId === "suporte_dfcom") {
      return await proxy(functionsBaseUrl, "suporte_dfcom", body);
    }
    if (buttonId === "falar_com_concierge" || buttonId === "concierge_falar") {
      return await proxy(functionsBaseUrl, "concierge_falar", body);
    }
    if (buttonId === "acompanhar_chamado") {
      return await proxy(functionsBaseUrl, "acompanhar_chamado", body);
    }
    if (buttonId === "emergencia_menu") {
      return await proxy(functionsBaseUrl, "emergencia_menu", body);
    }
    if (buttonId === "personalizado_finalizar") {
      return await proxy(functionsBaseUrl, "personalizado_finalizar", body);
    }

    // 🔹 DFCOM FUNCTIONS
    if (buttonId === "falar_com_dfcom") {
      return await proxy(functionsBaseUrl, "falar_com_dfcom", body);
    }
    if (buttonId === "finalizar_atendimento_dfcom") {
      return await proxy(functionsBaseUrl, "finalizar_atendimento_dfcom", body);
    }

    // 🔹 VOLTAR AO MENU INICIAL
    if (buttonId === "voltar_menu_inicial") {
      const res = await fetch(`${functionsBaseUrl}/menu_principal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify(body),
      });
      return new Response(await res.text(), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: res.status,
      });
    }

    // 🔹 RESPONDER TICKET
    if (buttonId.startsWith("responder_ticket_")) {
      return await proxy(functionsBaseUrl, "process-ticket-response", body);
    }

    // 🔹 FINALIZAR TICKET
    if (buttonId.startsWith("finalizar_ticket_")) {
      return await proxy(functionsBaseUrl, "process-ticket-response", body);
    }

    // ❌ Pula DFCom por enquanto
    if (buttonId === "autoatendimento_dfcom") {
      console.log("🚫 DFCom desativado por enquanto");
      return new Response(
        JSON.stringify({ success: false, message: "DFCom ainda não implementado" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
      );
    }

    // Caso não reconheça
    console.log("⏭️ NENHUMA CONDIÇÃO ATENDIDA - ButtonId:", buttonId, "Message:", message);
    console.log("⏭️ Ignorando requisição");
    return new Response(JSON.stringify({ success: true, ignored: true, buttonId, message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });
  } catch (err) {
    console.error("❌ Erro no bot_base_1:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno", details: err.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
});

// 🔧 Função helper para redirecionar chamadas
async function proxy(baseUrl: string, functionName: string, body: any) {
  try {
    console.log(`🔄 Redirecionando para ${functionName}`);
    const res = await fetch(`${baseUrl}/${functionName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify(body),
    });

    const responseText = await res.text();
    console.log(`📤 Resposta de ${functionName}:`, res.status, responseText.substring(0, 200));

    return new Response(responseText, {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: res.status,
    });
  } catch (error) {
    console.error(`❌ Erro no proxy para ${functionName}:`, error);
    return new Response(
      JSON.stringify({ error: `Erro no proxy para ${functionName}`, details: error.message }),
      { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 500 }
    );
  }
}