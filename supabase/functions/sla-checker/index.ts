import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface Database {
  public: {
    Tables: {
      tickets: any;
      notifications_queue: any;
      system_logs: any;
    };
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 SLA Checker iniciado');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);

    // Verificar se estamos em horário comercial
    const { data: isBusinessHoursData, error: bhError } = await supabase.rpc('is_business_hours_check', {
      p_date: new Date().toISOString()
    });

    if (bhError) {
      console.error('❌ Erro ao verificar horário comercial:', bhError);
      throw bhError;
    }

    const isBusinessHours = isBusinessHoursData as boolean;
    console.log(`⏰ Horário comercial: ${isBusinessHours}`);

    // 1. PAUSAR TICKETS FORA DO HORÁRIO
    if (!isBusinessHours) {
      console.log('🌙 Fora do horário comercial - pausando tickets ativos');
      
      const { error: pauseError } = await supabase
        .from('tickets')
        .update({ sla_pausado_horario: true })
        .in('status', ['aberto', 'em_atendimento', 'escalonado'])
        .eq('sla_pausado_horario', false);

      if (pauseError) {
        console.error('❌ Erro ao pausar tickets:', pauseError);
      } else {
        console.log('✅ Tickets pausados por horário');
      }
    }

    // 2. RETOMAR TICKETS DURANTE O HORÁRIO
    if (isBusinessHours) {
      console.log('☀️ Horário comercial - retomando tickets pausados');
      
      const { error: resumeError } = await supabase
        .from('tickets')
        .update({ sla_pausado_horario: false })
        .in('status', ['aberto', 'em_atendimento', 'escalonado'])
        .eq('sla_pausado_horario', true);

      if (resumeError) {
        console.error('❌ Erro ao retomar tickets:', resumeError);
      } else {
        console.log('✅ Tickets retomados');
      }
    }

    // 3. DETECTAR TICKETS VENCIDOS (apenas durante horário comercial)
    if (isBusinessHours) {
      console.log('🔍 Detectando tickets vencidos');

      const { data: overdueTickets, error: overdueError } = await supabase
        .from('tickets')
        .select('id, codigo_ticket, titulo, data_limite_sla, prioridade, unidade_id')
        .neq('status', 'concluido')
        .neq('status_sla', 'vencido')
        .lt('data_limite_sla', new Date().toISOString())
        .eq('sla_pausado_horario', false);

      if (overdueError) {
        console.error('❌ Erro ao buscar tickets vencidos:', overdueError);
      } else if (overdueTickets && overdueTickets.length > 0) {
        console.log(`⚠️ Encontrados ${overdueTickets.length} tickets vencidos`);

        // 4. ESCALAR TICKETS VENCIDOS
        const ticketIds = overdueTickets.map(t => t.id);
        
        const { error: escalateError } = await supabase
          .from('tickets')
          .update({
            status_sla: 'vencido',
            sla_escalado_em: new Date().toISOString(),
            sla_escalado_nivel: supabase.rpc('COALESCE', { value: 'sla_escalado_nivel', default_value: 0 })
          })
          .in('id', ticketIds);

        if (escalateError) {
          console.error('❌ Erro ao escalar tickets:', escalateError);
        } else {
          console.log(`✅ ${ticketIds.length} tickets escalados`);
        }

        // 5. CRIAR NOTIFICAÇÕES DE VENCIMENTO
        for (const ticket of overdueTickets) {
          // Verificar se já existe notificação recente
          const { data: existingNotif } = await supabase
            .from('notifications_queue')
            .select('id')
            .eq('ticket_id', ticket.id)
            .eq('type', 'sla_breach')
            .in('status', ['pending', 'processing', 'sent'])
            .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Últimas 2 horas
            .limit(1);

          if (!existingNotif || existingNotif.length === 0) {
            const { error: notifError } = await supabase
              .from('notifications_queue')
              .insert({
                type: 'sla_breach',
                ticket_id: ticket.id,
                payload: {
                  codigo_ticket: ticket.codigo_ticket,
                  titulo: ticket.titulo,
                  data_limite_sla: ticket.data_limite_sla,
                  prioridade: ticket.prioridade,
                  unidade_id: ticket.unidade_id
                },
                status: 'pending'
              });

            if (notifError) {
              console.error(`❌ Erro ao criar notificação para ticket ${ticket.codigo_ticket}:`, notifError);
            } else {
              console.log(`📨 Notificação criada para ticket ${ticket.codigo_ticket}`);
            }
          }
        }
      } else {
        console.log('✅ Nenhum ticket vencido encontrado');
      }
    }

    // 6. REGISTRAR LOG
    await supabase.from('system_logs').insert({
      level: 'info',
      message: `SLA Checker executado - Horário: ${isBusinessHours ? 'Comercial' : 'Não Comercial'}`,
      metadata: {
        is_business_hours: isBusinessHours,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        is_business_hours: isBusinessHours,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );
  } catch (error) {
    console.error('❌ Erro no SLA Checker:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
