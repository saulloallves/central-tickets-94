import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { title, message, type, equipe_id, recipients, payload = {} } = await req.json()

    // Validation
    if (!title || !type) {
      throw new Error('Title and type are required')
    }

    if (!['ticket', 'sla', 'alert', 'info', 'crisis'].includes(type)) {
      throw new Error('Invalid notification type')
    }

    // 1. Create notification
    const { data: notification, error: notificationError } = await supabase
      .from('internal_notifications')
      .insert([{ 
        title, 
        message, 
        type, 
        equipe_id, 
        payload,
        created_by: null // System generated
      }])
      .select()
      .single()

    if (notificationError) {
      console.error('Error creating notification:', notificationError)
      throw notificationError
    }

    // 2. Auto-derive recipients if not provided
    let finalRecipients = recipients || []
    
    if (!recipients && equipe_id) {
      // Get all active members of the team
      const { data: teamMembers, error: membersError } = await supabase
        .from('equipe_members')
        .select('user_id')
        .eq('equipe_id', equipe_id)
        .eq('ativo', true)

      if (membersError) {
        console.error('Error fetching team members:', membersError)
      } else {
        finalRecipients = teamMembers.map(member => member.user_id)
      }
    }

    // 3. Create recipients
    if (finalRecipients.length > 0) {
      const recipientsData = finalRecipients.map((userId: string) => ({
        notification_id: notification.id,
        user_id: userId,
      }))

      const { error: recipientsError } = await supabase
        .from('internal_notification_recipients')
        .insert(recipientsData)

      if (recipientsError) {
        console.error('Error creating recipients:', recipientsError)
        throw recipientsError
      }
    }

    console.log(`Created notification: ${notification.id} for ${finalRecipients.length} recipients`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        notification,
        recipients_count: finalRecipients.length 
      }), 
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Error in create-internal-notification:', error)
    return new Response(
      JSON.stringify({ error: error.message }), 
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})