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

    if (!['ticket', 'sla', 'alert', 'info', 'crisis', 'franqueado_respondeu'].includes(type)) {
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
    
    if (!recipients) {
      // SEMPRE incluir administradores em todas as notificações
      const { data: admins, error: adminsError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')

      if (!adminsError && admins) {
        finalRecipients = admins.map(admin => admin.user_id)
        console.log(`Always including ${finalRecipients.length} admins in notifications`)
      }

      // Se tem equipe específica, TAMBÉM incluir membros da equipe
      if (equipe_id) {
        const { data: teamMembers, error: membersError } = await supabase
          .from('equipe_members')
          .select('user_id')
          .eq('equipe_id', equipe_id)
          .eq('ativo', true)

        if (membersError) {
          console.error('Error fetching team members:', membersError)
        } else {
          // Adicionar membros da equipe aos administradores (evitar duplicatas)
          const teamMemberIds = teamMembers.map(member => member.user_id)
          const uniqueRecipients = [...new Set([...finalRecipients, ...teamMemberIds])]
          finalRecipients = uniqueRecipients
          console.log(`Found ${teamMemberIds.length} team members for equipe_id: ${equipe_id}`)
          console.log(`Total unique recipients (admins + team): ${finalRecipients.length}`)
        }
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