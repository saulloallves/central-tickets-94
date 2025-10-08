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

    if (!['ticket', 'sla', 'alert', 'info', 'crisis', 'franqueado_respondeu', 'ticket_forwarded'].includes(type)) {
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
      console.log('🔍 Auto-deriving recipients...');
      
      // SEMPRE incluir administradores em todas as notificações
      const { data: admins, error: adminsError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin')
        .eq('approved', true)

      if (adminsError) {
        console.error('❌ Error fetching admins:', adminsError);
      } else if (admins && admins.length > 0) {
        finalRecipients = admins.map(admin => admin.user_id)
        console.log(`✅ Found ${finalRecipients.length} admins:`, finalRecipients);
      } else {
        console.warn('⚠️ No admins found!');
      }

      // Se tem equipe específica, TAMBÉM incluir membros da equipe
      if (equipe_id) {
        console.log(`🔍 Fetching team members for equipe_id: ${equipe_id}`);
        
        const { data: teamMembers, error: membersError } = await supabase
          .from('equipe_members')
          .select('user_id')
          .eq('equipe_id', equipe_id)
          .eq('ativo', true)

        if (membersError) {
          console.error('❌ Error fetching team members:', membersError)
        } else if (teamMembers && teamMembers.length > 0) {
          // Adicionar membros da equipe aos administradores (evitar duplicatas)
          const teamMemberIds = teamMembers.map(member => member.user_id)
          const uniqueRecipients = [...new Set([...finalRecipients, ...teamMemberIds])]
          finalRecipients = uniqueRecipients
          console.log(`✅ Found ${teamMemberIds.length} team members`)
          console.log(`✅ Total unique recipients (admins + team): ${finalRecipients.length}`)
        } else {
          console.log(`ℹ️ No team members found for equipe_id: ${equipe_id}`);
        }
      }
    }

    console.log(`📊 Final recipients count: ${finalRecipients.length}`, finalRecipients);

    // 3. Create recipients
    if (finalRecipients.length > 0) {
      const recipientsData = finalRecipients.map((userId: string) => ({
        notification_id: notification.id,
        user_id: userId,
      }))

      console.log(`📝 Inserting ${recipientsData.length} recipients...`);

      const { error: recipientsError } = await supabase
        .from('internal_notification_recipients')
        .insert(recipientsData)

      if (recipientsError) {
        console.error('❌ Error creating recipients:', recipientsError)
        throw recipientsError
      }
      
      console.log(`✅ Successfully created ${recipientsData.length} recipient records`);
    } else {
      console.warn('⚠️ No recipients to create!');
    }

    console.log(`Created notification: ${notification.id} for ${finalRecipients.length} recipients`)

    // 4. Enviar push notifications
    try {
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      console.log('🔑 Using service role key for push notification');
      
      const pushResponse = await supabase.functions.invoke('send-push-notification', {
        body: {
          title,
          message: message || title,
          userIds: finalRecipients,
          data: {
            type,
            notification_id: notification.id,
            ...payload
          }
        },
        headers: {
          Authorization: `Bearer ${serviceRoleKey}`
        }
      });

      if (pushResponse.error) {
        console.error('❌ Erro ao enviar push:', pushResponse.error);
      } else {
        console.log(`✅ Push enviado: ${pushResponse.data?.sent || 0} dispositivos`);
      }
    } catch (pushError) {
      // Não falhar se push falhar - apenas log
      console.error('⚠️ Push notification falhou (não crítico):', pushError);
    }

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