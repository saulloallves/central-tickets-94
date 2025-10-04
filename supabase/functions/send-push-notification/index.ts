import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  userIds?: string[];
  equipeId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const payload: PushPayload = await req.json();
    console.log('📤 Enviando push notification:', payload);

    // Buscar subscriptions dos usuários
    let query = supabaseClient
      .from('push_subscriptions')
      .select('subscription, user_id');

    if (payload.userIds && payload.userIds.length > 0) {
      query = query.in('user_id', payload.userIds);
    } else if (payload.equipeId) {
      // Buscar membros da equipe
      const { data: members } = await supabaseClient
        .from('equipe_members')
        .select('user_id')
        .eq('equipe_id', payload.equipeId)
        .eq('ativo', true);
      
      if (members && members.length > 0) {
        const userIds = members.map(m => m.user_id);
        query = query.in('user_id', userIds);
      }
    }

    const { data: subscriptions, error } = await query;

    if (error) {
      console.error('❌ Erro ao buscar subscriptions:', error);
      throw error;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️ Nenhuma subscription encontrada');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'Nenhum dispositivo registrado' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📱 Enviando para ${subscriptions.length} dispositivos`);

    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const vapidMailto = Deno.env.get('VAPID_MAILTO');

    if (!vapidPublicKey || !vapidPrivateKey) {
      throw new Error('VAPID keys não configuradas');
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-96x96.png',
      data: payload.data || {},
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const subscription = sub.subscription as any;
          
          const response = await fetch('https://fcm.googleapis.com/fcm/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `key=${vapidPrivateKey}`,
            },
            body: JSON.stringify({
              to: subscription.endpoint.split('/').pop(),
              notification: {
                title: payload.title,
                body: payload.body,
                icon: payload.icon || '/icons/icon-192x192.png',
                badge: payload.badge || '/icons/icon-96x96.png',
              },
              data: payload.data || {},
            }),
          });

          if (!response.ok) {
            // Se a subscription estiver inválida, remover
            if (response.status === 410) {
              await supabaseClient
                .from('push_subscriptions')
                .delete()
                .eq('user_id', sub.user_id);
              console.log(`🗑️ Subscription inválida removida: ${sub.user_id}`);
            }
            throw new Error(`HTTP ${response.status}`);
          }

          return { success: true, userId: sub.user_id };
        } catch (error) {
          console.error(`❌ Erro ao enviar para ${sub.user_id}:`, error);
          return { success: false, userId: sub.user_id, error };
        }
      })
    );

    const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
    const failed = results.length - successful;

    console.log(`✅ Enviado: ${successful} | ❌ Falhou: ${failed}`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: successful,
        failed,
        total: results.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('💥 Erro ao enviar push:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
