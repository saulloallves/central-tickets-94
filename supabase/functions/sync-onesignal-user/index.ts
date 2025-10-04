import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
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

    // Verify JWT
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { player_id, user_id } = await req.json();

    if (!player_id || !user_id) {
      throw new Error('Missing required fields: player_id, user_id');
    }

    // Verify that the requesting user matches the user_id
    if (user.id !== user_id) {
      throw new Error('User ID mismatch');
    }

    // Get user role for tagging
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user_id);

    const roles = userRoles?.map((r) => r.role) || [];

    // Get user equipes for tagging
    const { data: userEquipes } = await supabaseClient
      .from('equipe_members')
      .select('equipe_id, equipes(nome)')
      .eq('user_id', user_id)
      .eq('ativo', true);

    const equipes = userEquipes?.map((e) => e.equipe_id) || [];

    // Upsert player_id into push_subscriptions
    const { error: upsertError } = await supabaseClient
      .from('push_subscriptions')
      .upsert(
        {
          user_id: user_id,
          onesignal_player_id: player_id,
          platform: 'web',
          onesignal_tags: {
            roles: roles,
            equipes: equipes,
          },
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id',
        }
      );

    if (upsertError) {
      console.error('Error upserting player_id:', upsertError);
      throw upsertError;
    }

    // Tag the user in OneSignal with their roles and equipes
    const ONESIGNAL_API_KEY = Deno.env.get('ONESIGNAL_REST_API_KEY');
    const ONESIGNAL_APP_ID = '23de91fb-41d4-499d-a367-d863ffe4fdbe';

    if (ONESIGNAL_API_KEY) {
      try {
        // Update player tags in OneSignal
        const tagsResponse = await fetch(
          `https://api.onesignal.com/apps/${ONESIGNAL_APP_ID}/users/${player_id}`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Basic ${ONESIGNAL_API_KEY}`,
            },
            body: JSON.stringify({
              tags: {
                user_id: user_id,
                roles: roles.join(','),
                equipes: equipes.join(','),
              },
            }),
          }
        );

        if (!tagsResponse.ok) {
          console.warn('Failed to update OneSignal tags:', await tagsResponse.text());
        } else {
          console.log('✅ OneSignal tags updated successfully');
        }
      } catch (error) {
        console.error('Error updating OneSignal tags:', error);
        // Don't throw - tagging failure shouldn't block the sync
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        player_id,
        user_id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error in sync-onesignal-user:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
