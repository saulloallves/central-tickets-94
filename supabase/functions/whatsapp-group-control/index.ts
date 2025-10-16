import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ZAPIClient {
  instanceId: string;
  token: string;
  clientToken: string;
  baseUrl: string;
}

async function loadZAPIConfig(supabase: any): Promise<ZAPIClient | null> {
  try {
    const { data, error } = await supabase
      .from('messaging_providers')
      .select('*')
      .eq('provider_name', 'zapi')
      .eq('is_active', true)
      .maybeSingle();

    if (error || !data) {
      console.error('❌ Erro ao carregar configuração Z-API:', error);
      return null;
    }

    return {
      instanceId: data.instance_id,
      token: data.instance_token,
      clientToken: data.client_token,
      baseUrl: data.base_url || 'https://api.z-api.io'
    };
  } catch (error) {
    console.error('❌ Erro ao carregar Z-API config:', error);
    return null;
  }
}

async function promoteToAdmin(zapiConfig: ZAPIClient, groupId: string, phone: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${zapiConfig.baseUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/promote-participant`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiConfig.clientToken,
        },
        body: JSON.stringify({
          groupId: groupId,
          phone: phone,
        }),
      }
    );

    const result = await response.json();
    console.log('✅ Promoção para admin:', result);
    return response.ok;
  } catch (error) {
    console.error('❌ Erro ao promover para admin:', error);
    return false;
  }
}

async function demoteFromAdmin(zapiConfig: ZAPIClient, groupId: string, phone: string): Promise<boolean> {
  try {
    const response = await fetch(
      `${zapiConfig.baseUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/demote-participant`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiConfig.clientToken,
        },
        body: JSON.stringify({
          groupId: groupId,
          phone: phone,
        }),
      }
    );

    const result = await response.json();
    console.log('✅ Remoção de admin:', result);
    return response.ok;
  } catch (error) {
    console.error('❌ Erro ao remover admin:', error);
    return false;
  }
}

async function updateGroupSettings(
  zapiConfig: ZAPIClient,
  groupId: string,
  settings: { onlyAdminsCanSendMessages?: boolean }
): Promise<boolean> {
  try {
    const response = await fetch(
      `${zapiConfig.baseUrl}/instances/${zapiConfig.instanceId}/token/${zapiConfig.token}/update-group-settings`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': zapiConfig.clientToken,
        },
        body: JSON.stringify({
          groupId: groupId,
          ...settings,
        }),
      }
    );

    const result = await response.json();
    console.log('✅ Configurações do grupo atualizadas:', result);
    return response.ok;
  } catch (error) {
    console.error('❌ Erro ao atualizar configurações do grupo:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      throw new Error("Autorização não fornecida");
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );

    if (authError || !user) {
      throw new Error("Usuário não autenticado");
    }

    const { action, groupId, phone, nome, onlyAdminsCanSendMessages } = await req.json();

    // Carregar configuração Z-API
    const zapiConfig = await loadZAPIConfig(supabase);
    if (!zapiConfig) {
      throw new Error("Configuração Z-API não encontrada");
    }

    // Buscar ou criar registro do grupo
    let { data: groupData, error: groupError } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('group_id', groupId)
      .maybeSingle();

    if (!groupData) {
      // Criar novo grupo se não existir
      const { data: newGroup, error: createError } = await supabase
        .from('whatsapp_groups')
        .insert({
          group_id: groupId,
          nome: nome || 'Grupo WhatsApp',
          status: 'aberto'
        })
        .select()
        .single();

      if (createError) {
        throw createError;
      }
      groupData = newGroup;
    }

    let result = { success: false, message: '' };

    switch (action) {
      case 'add_admin':
        const promoteSuccess = await promoteToAdmin(zapiConfig, groupId, phone);
        if (promoteSuccess) {
          // Registrar admin no banco
          await supabase
            .from('whatsapp_group_admins')
            .insert({
              group_id: groupData.id,
              phone: phone,
              nome: nome,
              added_by: user.id
            })
            .onConflict('group_id, phone')
            .merge();

          // Log da ação
          await supabase
            .from('whatsapp_group_actions')
            .insert({
              group_id: groupData.id,
              action_type: 'add_admin',
              performed_by: user.id,
              details: { phone, nome }
            });

          result = { success: true, message: 'Admin adicionado com sucesso' };
        }
        break;

      case 'remove_admin':
        const demoteSuccess = await demoteFromAdmin(zapiConfig, groupId, phone);
        if (demoteSuccess) {
          // Remover admin do banco
          await supabase
            .from('whatsapp_group_admins')
            .update({ is_active: false })
            .eq('group_id', groupData.id)
            .eq('phone', phone);

          // Log da ação
          await supabase
            .from('whatsapp_group_actions')
            .insert({
              group_id: groupData.id,
              action_type: 'remove_admin',
              performed_by: user.id,
              details: { phone }
            });

          result = { success: true, message: 'Admin removido com sucesso' };
        }
        break;

      case 'close_group':
        const closeSuccess = await updateGroupSettings(zapiConfig, groupId, {
          onlyAdminsCanSendMessages: true
        });
        if (closeSuccess) {
          await supabase
            .from('whatsapp_groups')
            .update({ status: 'fechado' })
            .eq('id', groupData.id);

          await supabase
            .from('whatsapp_group_actions')
            .insert({
              group_id: groupData.id,
              action_type: 'fechar',
              performed_by: user.id,
              details: {}
            });

          result = { success: true, message: 'Grupo fechado com sucesso' };
        }
        break;

      case 'open_group':
        const openSuccess = await updateGroupSettings(zapiConfig, groupId, {
          onlyAdminsCanSendMessages: false
        });
        if (openSuccess) {
          await supabase
            .from('whatsapp_groups')
            .update({ status: 'aberto' })
            .eq('id', groupData.id);

          await supabase
            .from('whatsapp_group_actions')
            .insert({
              group_id: groupData.id,
              action_type: 'abrir',
              performed_by: user.id,
              details: {}
            });

          result = { success: true, message: 'Grupo aberto com sucesso' };
        }
        break;

      default:
        throw new Error('Ação não reconhecida');
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error('❌ Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
