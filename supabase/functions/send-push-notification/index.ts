import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  title: string;
  message: string;
  userIds?: string[];
  equipeId?: string;
  data?: Record<string, any>;
  url?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Check if request is from service role (backend edge function)
    const authHeader = req.headers.get('Authorization');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const isServiceRole = authHeader?.includes(serviceRoleKey || '');

    console.log('🔐 Auth check - Is service role:', isServiceRole);

    if (!isServiceRole) {
      // Verify authentication and authorization for user requests
      const {
        data: { user },
        error: authError,
      } = await supabaseClient.auth.getUser();

      if (authError || !user) {
        console.error('❌ Auth error:', authError);
        throw new Error('Unauthorized');
      }

      console.log('✅ User authenticated:', user.id);

      // Check if user is admin or diretoria
      const { data: userRoles } = await supabaseClient
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .in('role', ['admin', 'diretoria']);

      if (!userRoles || userRoles.length === 0) {
        console.error('❌ User lacks required role');
        throw new Error('Forbidden: Only admins and diretoria can send push notifications');
      }

      console.log('✅ User has required role:', userRoles);
    } else {
      console.log('✅ Service role authenticated - skipping user checks');
    }

    const payload: PushPayload = await req.json();
    const { title, message, userIds, equipeId, data, url } = payload;

    if (!title || !message) {
      throw new Error('Title and message are required');
    }

    // Get player IDs from database
    let playerIdsQuery = supabaseClient
      .from('push_subscriptions')
      .select('onesignal_player_id')
      .not('onesignal_player_id', 'is', null);

    if (userIds && userIds.length > 0) {
      playerIdsQuery = playerIdsQuery.in('user_id', userIds);
    } else if (equipeId) {
      // Get all users from the equipe
      const { data: equipeMembers } = await supabaseClient
        .from('equipe_members')
        .select('user_id')
        .eq('equipe_id', equipeId)
        .eq('ativo', true);

      const equipeUserIds = equipeMembers?.map((m) => m.user_id) || [];
      if (equipeUserIds.length > 0) {
        playerIdsQuery = playerIdsQuery.in('user_id', equipeUserIds);
      } else {
        throw new Error('No active members found in equipe');
      }
    } else {
      throw new Error('Either userIds or equipeId must be provided');
    }

    const { data: subscriptions, error: subsError } = await playerIdsQuery;

    if (subsError) {
      console.error('Error fetching subscriptions:', subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: 'No push subscriptions found for target users',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    const playerIds = subscriptions
      .map((s) => s.onesignal_player_id)
      .filter((id) => id !== null);

    if (playerIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          sent: 0,
          message: 'No OneSignal player IDs found',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Send notification via OneSignal REST API
    const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
    const ONESIGNAL_APP_ID = '23de91fb-41d4-499d-a367-d863ffe4fdbe';

    if (!ONESIGNAL_API_KEY) {
      throw new Error('ONESIGNAL_REST_API_KEY not configured');
    }

    const notificationPayload = {
      app_id: ONESIGNAL_APP_ID,
      include_player_ids: playerIds,
      headings: { en: title },
      contents: { en: message },
      data: data || {},
      ...(url && { url }),
    };

    console.log('📤 Sending OneSignal notification to', playerIds.length, 'players');

    const response = await fetch('https://api.onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${ONESIGNAL_API_KEY}`,
      },
      body: JSON.stringify(notificationPayload),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error('OneSignal API error:', responseData);
      throw new Error(`OneSignal API error: ${JSON.stringify(responseData)}`);
    }

    console.log('✅ OneSignal notification sent successfully:', responseData);

    return new Response(
      JSON.stringify({
        success: true,
        sent: playerIds.length,
        onesignal_response: responseData,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error sending push notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
