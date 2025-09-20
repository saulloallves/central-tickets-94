import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConversationState {
  awaiting_response_for_ticket: string;
  expires_at: string;
}

// Função para salvar estado conversacional
async function saveConversationState(
  supabase: any, 
  phone: string, 
  instanceId: string, 
  ticketId: string
): Promise<void> {
  const state: ConversationState = {
    awaiting_response_for_ticket: ticketId,
    expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutos
  };

  try {
    await supabase
      .from('whatsapp_conversas')
      .upsert({
        instance_id: instanceId,
        contact_phone: phone,
        connected_phone: Deno.env.get('ZAPI_INSTANCE_ID') || '',
        meta: state,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'instance_id,contact_phone,connected_phone'
      });

    console.log(`💾 Estado salvo para ${phone}: aguardando resposta do ticket ${ticketId}`);
  } catch (error) {
    console.error('Erro ao salvar estado:', error);
  }
}

// Função para enviar mensagem via Z-API
async function sendZapiMessage(phone: string, message: string): Promise<boolean> {
  try {
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const token = Deno.env.get('ZAPI_TOKEN');
    const clientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');
    const baseUrl = Deno.env.get('ZAPI_BASE_URL') || 'https://api.z-api.io';

    if (!instanceId || !token || !clientToken) {
      console.error('Configuração Z-API incompleta');
      return false;
    }

    const response = await fetch(`${baseUrl}/instances/${instanceId}/token/${token}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Client-Token': clientToken,
      },
      body: JSON.stringify({
        phone: phone,
        message: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro ao enviar via Z-API:', errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Erro no envio Z-API:', error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();
    console.log('📦 Process ticket response body:', JSON.stringify(body, null, 2));

    // Extrair buttonId e phone
    const buttonId = body?.buttonsResponseMessage?.buttonId || 
                    body?.buttonId || 
                    body?.button?.id || 
                    body?.selectedButtonId || "";
    const phone = body?.phone || body?.participantPhone;
    const instanceId = Deno.env.get('ZAPI_INSTANCE_ID') || '';

    if (!phone) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Phone number não encontrado' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Responder ticket
    if (buttonId.startsWith("responder_ticket_")) {
      const ticketId = buttonId.replace("responder_ticket_", "");
      
      // Verificar se ticket existe
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('id, codigo_ticket, titulo, status')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        await sendZapiMessage(phone, "❌ Ticket não encontrado ou inválido.");
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Ticket não encontrado' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Salvar estado conversacional
      await saveConversationState(supabase, phone, instanceId, ticketId);

      // Enviar mensagem pedindo resposta
      const message = `📝 *Responder Ticket #${ticket.codigo_ticket}*

${ticket.titulo}

Digite sua resposta para este ticket. Sua mensagem será adicionada ao histórico do atendimento.

⏰ _Esta sessão expira em 5 minutos._`;

      await sendZapiMessage(phone, message);

      return new Response(JSON.stringify({ 
        success: true,
        action: 'awaiting_response',
        ticket_id: ticketId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Finalizar ticket
    if (buttonId.startsWith("finalizar_ticket_")) {
      const ticketId = buttonId.replace("finalizar_ticket_", "");
      
      // Buscar ticket
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .select('id, codigo_ticket, titulo, status')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticket) {
        await sendZapiMessage(phone, "❌ Ticket não encontrado ou inválido.");
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Ticket não encontrado' 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Verificar se já está finalizado
      if (ticket.status === 'concluido') {
        await sendZapiMessage(phone, `✅ O ticket #${ticket.codigo_ticket} já está finalizado.`);
        return new Response(JSON.stringify({ 
          success: true,
          action: 'already_finished'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Finalizar ticket
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          status: 'concluido',
          resolvido_em: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (updateError) {
        console.error('Erro ao finalizar ticket:', updateError);
        await sendZapiMessage(phone, "❌ Erro ao finalizar ticket. Tente novamente.");
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Erro ao finalizar ticket' 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      // Adicionar mensagem de finalização ao histórico
      await supabase
        .from('ticket_mensagens')
        .insert({
          ticket_id: ticketId,
          direcao: 'entrada',
          mensagem: 'Ticket finalizado pelo usuário via WhatsApp',
          canal: 'whatsapp',
          usuario_id: null
        });

      await sendZapiMessage(phone, `✅ *Ticket finalizado com sucesso!*

#${ticket.codigo_ticket} - ${ticket.titulo}

Obrigado por utilizar nosso sistema de suporte.`);

      return new Response(JSON.stringify({ 
        success: true,
        action: 'ticket_finished',
        ticket_id: ticketId
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Ação não reconhecida' 
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Erro geral:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});