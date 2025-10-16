import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Cliente Supabase com ANON_KEY (para operações gerais)
const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_ANON_KEY") ?? "");

// Cliente Supabase com SERVICE_ROLE_KEY (para bypass RLS em webhooks)
const supabaseAdmin = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

// ✅ Usando banco principal - tabela atendente_unidades migrada

// Configuração Z-API específica para BOT
class BotZAPIClient {
  private instanceId: string;
  private token: string;
  private clientToken: string;
  private baseUrl: string;

  constructor() {
    this.instanceId = "";
    this.token = "";
    this.clientToken = "";
    this.baseUrl = "https://api.z-api.io";
  }

  async loadConfig() {
    console.log("🔧 Carregando configuração do bot...");

    // Primeiro, tenta buscar da configuração do banco
    try {
      const { data: config, error } = await supabase
        .from("messaging_providers")
        .select("instance_id, instance_token, client_token, base_url")
        .eq("provider_name", "zapi_bot")
        .eq("is_active", true)
        .maybeSingle();

      if (!error && config && config.instance_id) {
        console.log("✅ Configuração encontrada no banco:", config.instance_id?.substring(0, 8) + "...");
        this.instanceId = config.instance_id;
        this.token = config.instance_token;
        this.clientToken = config.client_token;
        this.baseUrl = config.base_url || "https://api.z-api.io";
        return;
      } else {
        console.log(
          "⚠️ Configuração não encontrada no banco, usando env vars:",
          error?.message || "Config não encontrada",
        );
      }
    } catch (error) {
      console.error("❌ Erro ao buscar configuração no banco:", error);
    }

    // Fallback para variáveis de ambiente
    this.instanceId = Deno.env.get("BOT_ZAPI_INSTANCE_ID") || Deno.env.get("ZAPI_INSTANCE_ID") || "";
    this.token = Deno.env.get("BOT_ZAPI_TOKEN") || Deno.env.get("ZAPI_TOKEN") || "";
    this.clientToken = Deno.env.get("BOT_ZAPI_CLIENT_TOKEN") || Deno.env.get("ZAPI_CLIENT_TOKEN") || "";
    this.baseUrl = Deno.env.get("BOT_ZAPI_BASE_URL") || Deno.env.get("ZAPI_BASE_URL") || "https://api.z-api.io";

    console.log("📝 Usando configuração das env vars:", this.instanceId?.substring(0, 8) + "...");
  }

  async sendMessage(phone: string, message: string, buttons?: any[]): Promise<boolean> {
    if (!this.instanceId || !this.token || !this.clientToken) {
      console.error("BOT Z-API credentials not configured");
      return false;
    }

    try {
      let endpoint = "send-text";
      let body: any = {
        phone: phone,
        message: message,
      };

      if (buttons && buttons.length > 0) {
        endpoint = "send-button-list";
        body.buttonList = { buttons };
      }

      const response = await fetch(`${this.baseUrl}/instances/${this.instanceId}/token/${this.token}/${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Client-Token": this.clientToken,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        console.error("Failed to send BOT Z-API message:", await response.text());
        return false;
      }

      console.log("✅ BOT message sent successfully via Z-API");
      return true;
    } catch (error) {
      console.error("Error sending BOT Z-API message:", error);
      return false;
    }
  }

  isConfigured(): boolean {
    return !!(this.instanceId && this.token && this.clientToken);
  }
}

const botZapi = new BotZAPIClient();

// ✅ Função para verificar se grupo existe em unidades_whatsapp
async function checkGroupInWhatsappTable(groupId: string): Promise<{
  exists: boolean;
  codigoGrupo?: string;
  nomeGrupo?: string;
}> {
  try {
    console.log(`📱 Verificando grupo ${groupId} na tabela unidades_whatsapp...`);

    const { data, error } = await supabaseAdmin
      .from("unidades_whatsapp")
      .select("codigo_grupo, nome_grupo")
      .eq("id_grupo_branco", groupId)
      .maybeSingle();

    if (error) {
      console.error("❌ Erro ao consultar unidades_whatsapp:", error);
      return { exists: false };
    }

    if (data) {
      console.log(`✅ Grupo encontrado em unidades_whatsapp: ${data.nome_grupo} (código: ${data.codigo_grupo})`);
      return {
        exists: true,
        codigoGrupo: data.codigo_grupo,
        nomeGrupo: data.nome_grupo,
      };
    }

    console.log(`🚫 Grupo NÃO encontrado em unidades_whatsapp`);
    return { exists: false };
  } catch (error) {
    console.error("❌ Erro na verificação de unidades_whatsapp:", error);
    return { exists: false };
  }
}

// ✅ Função corrigida - sintaxe correta do Supabase
async function checkGroupInDatabase(groupId: string): Promise<boolean> {
  try {
    console.log(`🔍 Verificando grupo ${groupId} na tabela atendente_unidades...`);
    console.log(`🔍 Buscando por id_grupo_branco: "${groupId}"`);
    console.log(`🔑 Usando SERVICE_ROLE_KEY para bypass de RLS (webhook não tem auth)`);

    // Usar supabaseAdmin para bypass de RLS (webhooks não têm auth.uid())
    const { data, error, count } = await supabaseAdmin
      .from("atendente_unidades")
      .select("id, codigo_grupo, id_grupo_branco, grupo, ativo", { count: "exact" })
      .eq("id_grupo_branco", groupId)
      .eq("ativo", true);

    console.log(`📊 Query completa - Error:`, error);
    console.log(`📊 Query completa - Count:`, count);
    console.log(`📊 Query completa - Data length:`, data?.length || 0);

    if (error) {
      console.error("❌ Erro ao consultar tabela atendente_unidades:", error);
      return false;
    }

    if (data && data.length > 0) {
      console.log(
        `✅ Grupo ${groupId} encontrado! Registro(s):`,
        data.map((d) => `${d.grupo} (código: ${d.codigo_grupo}, id_branco: ${d.id_grupo_branco})`),
      );
      return true;
    } else {
      console.log(`🚫 Grupo NÃO encontrado para id_grupo_branco: "${groupId}"`);
      return false;
    }
  } catch (error) {
    console.error("❌ Erro na verificação de grupo:", error);
    return false;
  }
}

// Nova função para verificar se a unidade está cadastrada
async function checkUnitRegistration(groupId: string): Promise<{
  isRegistered: boolean;
  codigoGrupo?: string;
  nomeGrupo?: string;
}> {
  try {
    console.log(`🏢 Verificando cadastro da unidade para grupo ${groupId}...`);

    const { data, error } = await supabaseAdmin
      .from("unidades")
      .select("codigo_grupo, grupo, id_grupo_branco")
      .eq("id_grupo_branco", groupId)
      .maybeSingle();

    if (error) {
      console.error("❌ Erro ao verificar cadastro da unidade:", error);
      return { isRegistered: false };
    }

    if (data) {
      console.log(`✅ Unidade cadastrada: ${data.grupo} (código: ${data.codigo_grupo})`);
      return {
        isRegistered: true,
        codigoGrupo: data.codigo_grupo,
        nomeGrupo: data.grupo,
      };
    }

    // Buscar informações em atendente_unidades para a mensagem
    const { data: atendenteData } = await supabaseAdmin
      .from("atendente_unidades")
      .select("codigo_grupo, grupo")
      .eq("id_grupo_branco", groupId)
      .maybeSingle();

    console.log(`🚫 Unidade NÃO cadastrada no sistema`);
    return {
      isRegistered: false,
      codigoGrupo: atendenteData?.codigo_grupo,
      nomeGrupo: atendenteData?.grupo,
    };
  } catch (error) {
    console.error("❌ Erro ao verificar cadastro da unidade:", error);
    return { isRegistered: false };
  }
}

// Função para enviar notificação de grupo não autorizado
async function sendUnauthorizedGroupNotification(groupId: string) {
  try {
    console.log(`📢 Enviando notificação para grupo não autorizado: ${groupId}`);

    const functionsBaseUrl =
      Deno.env.get("FUNCTIONS_BASE_URL") || `https://hryurntaljdisohawpqf.supabase.co/functions/v1`;

    const response = await fetch(`${functionsBaseUrl}/create-internal-notification`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
      },
      body: JSON.stringify({
        title: "🚫 Grupo não autorizado tentou usar o bot",
        message: `O grupo ${groupId} tentou usar o bot_base_1 mas não está cadastrado na tabela atendente_unidades`,
        type: "alert",
        payload: {
          group_id: groupId,
          timestamp: new Date().toISOString(),
          function: "bot_base_1",
        },
      }),
    });

    if (!response.ok) {
      console.error("❌ Erro ao enviar notificação:", await response.text());
    } else {
      console.log("✅ Notificação enviada com sucesso");
    }
  } catch (error) {
    console.error("❌ Erro ao enviar notificação de grupo não autorizado:", error);
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

    // 🚫 FILTRO: Ignorar mensagens enviadas pelo próprio bot
    if (body?.fromMe === true) {
      console.log("⏭️ Ignorando mensagem do próprio bot (fromMe: true)");
      return new Response(
        JSON.stringify({ success: true, message: "Ignored: message from bot itself" }),
        { headers: { "Content-Type": "application/json", ...corsHeaders }, status: 200 }
      );
    }

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
    const KEYWORDS = [
      "testerobo",
      "testerobô",
      "menu",
      "menú",
      "robo",
      "robô",
      "ola robo",
      "ola robô",
      "olá robo",
      "olá robô"
    ];

    const functionsBaseUrl =
      Deno.env.get("FUNCTIONS_BASE_URL") || `https://hryurntaljdisohawpqf.supabase.co/functions/v1`;

    // 🔹 MENU INICIAL - Verificação EXATA (não frases que contenham)
    console.log("🔍 Verificando keywords:", KEYWORDS);
    console.log("🔍 Message para verificar:", `"${message}"`);
    const keywordMatch = KEYWORDS.some((k) => message.trim().toLowerCase() === k.toLowerCase());
    console.log("🔍 Keyword match encontrado:", keywordMatch);

    if (keywordMatch) {
      // FILTRO DINÂMICO: Verificar grupos quando usar palavras-chave
      if (isGroup) {
        // 1️⃣ PRIMEIRA VALIDAÇÃO: Grupo autorizado em atendente_unidades
        const isAuthorized = await checkGroupInDatabase(chatId);

        if (!isAuthorized) {
          console.log(`🚫 BOT_BASE_1: Grupo não autorizado em atendente_unidades (${chatId})`);
          
          // Verificar se existe em unidades_whatsapp
          const whatsappCheck = await checkGroupInWhatsappTable(chatId);
          
          if (whatsappCheck.exists) {
            console.log(`📱 Grupo encontrado em unidades_whatsapp - enviando orientação de cadastro`);
            
            // Enviar mensagem de orientação de cadastro
            const message = `🚫 *Unidade não vinculada*\n\n` +
              `Olá! Identificamos que esta unidade ainda não está vinculada ao sistema.\n\n` +
              `📋 *Código da unidade:* ${whatsappCheck.codigoGrupo || "Não identificado"}\n` +
              `🏢 *Nome:* ${whatsappCheck.nomeGrupo || "Não identificado"}\n\n` +
              `Para utilizar o bot, é necessário completar o cadastro da unidade.\n\n` +
              `👉 *Acesse:* cadastro.girabot.com.br\n\n` +
              `Após o cadastro, você poderá usar todas as funcionalidades do bot! 🤖`;

            await botZapi.sendMessage(chatId, message);

            // Enviar notificação interna
            try {
              await fetch(`${functionsBaseUrl}/create-internal-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
                },
                body: JSON.stringify({
                  title: "⚠️ Grupo não vinculado tentou usar o bot",
                  message: `Grupo ${whatsappCheck.nomeGrupo || chatId} (código: ${whatsappCheck.codigoGrupo || "N/A"}) existe em unidades_whatsapp mas não está vinculado em atendente_unidades`,
                  type: "alert",
                  payload: {
                    group_id: chatId,
                    codigo_grupo: whatsappCheck.codigoGrupo,
                    nome_grupo: whatsappCheck.nomeGrupo,
                    timestamp: new Date().toISOString(),
                    function: "bot_base_1",
                    needs_linking: true,
                  },
                }),
              });
            } catch (notificationError) {
              console.error("❌ Erro ao enviar notificação interna:", notificationError);
            }

            return new Response(
              JSON.stringify({
                success: false,
                message: "Group exists but not linked - registration required",
                codigo_grupo: whatsappCheck.codigoGrupo,
                nome_grupo: whatsappCheck.nomeGrupo,
              }),
              {
                headers: { "Content-Type": "application/json", ...corsHeaders },
                status: 403,
              },
            );
    } else {
      console.log(`🚫 Grupo completamente não autorizado - não existe em nenhuma tabela`);
      
      // Enviar mensagem ao grupo informando que não está cadastrado
      const notRegisteredMessage = `🚫 *Grupo não cadastrado*\n\n` +
        `Olá! Este grupo ainda não está cadastrado no sistema Girabot.\n\n` +
        `Para utilizar o bot, é necessário realizar o cadastro completo da sua unidade.\n\n` +
        `👉 *Acesse:* cadastro.girabot.com.br\n\n` +
        `Após o cadastro, você terá acesso a todas as funcionalidades do bot! 🤖\n\n` +
        `_Se você já realizou o cadastro, entre em contato com o suporte._`;

      await botZapi.sendMessage(chatId, notRegisteredMessage);
      
      // Continuar enviando notificação interna para admins
      await sendUnauthorizedGroupNotification(chatId);

      return new Response(
        JSON.stringify({
          success: false,
          message: "Group not registered - message sent to group",
          group_id: chatId,
        }),
        {
          headers: { "Content-Type": "application/json", ...corsHeaders },
          status: 403,
        },
      );
    }
        }

        console.log("✅ BOT_BASE_1: Grupo autorizado - verificando cadastro da unidade");

        // 2️⃣ SEGUNDA VALIDAÇÃO: Unidade cadastrada em 'unidades'
        const unitCheck = await checkUnitRegistration(chatId);

        if (!unitCheck.isRegistered) {
          console.log(`🚫 BOT_BASE_1: Unidade não cadastrada (${chatId})`);

          // Enviar mensagem no grupo informando sobre falta de cadastro
          const message = `🚫 *Unidade não cadastrada*\n\n` +
            `Olá! Identificamos que esta unidade ainda não possui cadastro completo no sistema.\n\n` +
            `📋 *Código da unidade:* ${unitCheck.codigoGrupo || "Não identificado"}\n` +
            `🏢 *Nome:* ${unitCheck.nomeGrupo || "Não identificado"}\n\n` +
            `Para utilizar o bot, é necessário completar o cadastro da unidade.\n\n` +
            `👉 *Acesse:* cadastro.girabot.com.br\n\n` +
            `Após o cadastro, você poderá usar todas as funcionalidades do bot! 🤖`;

          await botZapi.sendMessage(chatId, message);

          // Enviar notificação interna para admins
          try {
            await fetch(`${functionsBaseUrl}/create-internal-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              },
              body: JSON.stringify({
                title: "⚠️ Grupo sem cadastro de unidade tentou usar o bot",
                message: `Grupo ${unitCheck.nomeGrupo || chatId} (código: ${unitCheck.codigoGrupo || "N/A"}) tentou usar o bot mas não tem cadastro na tabela unidades`,
                type: "alert",
                payload: {
                  group_id: chatId,
                  codigo_grupo: unitCheck.codigoGrupo,
                  nome_grupo: unitCheck.nomeGrupo,
                  timestamp: new Date().toISOString(),
                  function: "bot_base_1",
                  missing_registration: true,
                },
              }),
            });
          } catch (notificationError) {
            console.error("❌ Erro ao enviar notificação interna:", notificationError);
          }

          return new Response(
            JSON.stringify({
              success: false,
              message: "Unit not registered in system",
              codigo_grupo: unitCheck.codigoGrupo,
              nome_grupo: unitCheck.nomeGrupo,
            }),
            {
              headers: { "Content-Type": "application/json", ...corsHeaders },
              status: 403,
            },
          );
        }

        console.log(`✅ BOT_BASE_1: Unidade cadastrada - ${unitCheck.nomeGrupo} (${unitCheck.codigoGrupo})`);
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
      // Redireciona para autoatendimento padrão (mensagem de boas-vindas + senha)
      return await proxy(functionsBaseUrl, "autoatendimento", body);
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
    if (buttonId === "emergencia_finalizar") {
      return await proxy(functionsBaseUrl, "emergencia_finalizar", body);
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

    // 🔹 PROCESSAR AVALIAÇÃO
    if (buttonId.startsWith("avaliacao_")) {
      console.log("⭐ Processando avaliação:", buttonId);
      return await proxy(functionsBaseUrl, "processar-avaliacao-atendimento", body);
    }

    // ❌ Pula DFCom por enquanto
    if (buttonId === "autoatendimento_dfcom") {
      console.log("🚫 DFCom desativado por enquanto");
      return new Response(JSON.stringify({ success: false, message: "DFCom ainda não implementado" }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
        status: 200,
      });
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
    return new Response(JSON.stringify({ error: "Erro interno", details: err.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
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
    return new Response(JSON.stringify({ error: `Erro no proxy para ${functionName}`, details: error.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 500,
    });
  }
}
