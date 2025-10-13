import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { isBusinessHours, getNextBusinessHourStart, calculatePausedTime } from '../_shared/business-hours.ts';
import { toZonedTime } from 'npm:date-fns-tz@3.2.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PauseResumeRequest {
  action: 'pause' | 'resume';
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { action } = await req.json() as PauseResumeRequest;
    
    // 🔍 DEBUG: Logs de timezone (temporários)
    const debugNow = new Date();
    const debugSpTime = toZonedTime(debugNow, 'America/Sao_Paulo');
    console.log(`⏰ DEBUG Timezone - UTC: ${debugNow.toISOString()}`);
    console.log(`⏰ DEBUG Timezone - SP: ${debugSpTime.getHours()}:${debugSpTime.getMinutes().toString().padStart(2, '0')}`);
    console.log(`⏰ DEBUG isBusinessHours: ${isBusinessHours()}`);
    
    console.log(`🕐 Iniciando processamento de SLA - Ação: ${action}`);

    if (action === 'pause') {
      // ========================================
      // PAUSAR SLA (às 18h30)
      // ========================================
      
      // Buscar tickets que precisam ser pausados (incluindo aguardando_resposta)
      const { data: ticketsToPause, error: fetchError } = await supabase
        .from('tickets')
        .select('id, codigo_ticket, data_limite_sla, data_abertura')
        .in('status', ['aberto', 'em_atendimento', 'aguardando_resposta'])
        .eq('sla_pausado', false)
        .not('data_limite_sla', 'is', null);

      if (fetchError) {
        console.error('❌ Erro ao buscar tickets para pausar:', fetchError);
        throw fetchError;
      }

      console.log(`📊 Tickets a pausar: ${ticketsToPause?.length || 0}`);

      let pausedCount = 0;

      if (ticketsToPause && ticketsToPause.length > 0) {
        for (const ticket of ticketsToPause) {
          const now = new Date();
          const slaLimit = new Date(ticket.data_limite_sla);
          const timeRemaining = Math.floor((slaLimit.getTime() - now.getTime()) / 1000 / 60); // minutos

          // Pausar ticket
          const { error: updateError } = await supabase
            .from('tickets')
            .update({
              sla_pausado: true,
              sla_pausado_em: now.toISOString(),
            })
            .eq('id', ticket.id);

          if (updateError) {
            console.error(`❌ Erro ao pausar ticket ${ticket.codigo_ticket}:`, updateError);
            continue;
          }

          pausedCount++;

          // Log da ação
          await supabase.rpc('log_system_action', {
            p_tipo_log: 'sistema',
            p_entidade_afetada: 'tickets_sla',
            p_entidade_id: ticket.id,
            p_acao_realizada: `SLA pausado - Fim do expediente (18h30)`,
            p_dados_novos: {
              tempo_restante_minutos: timeRemaining,
              pausado_em: now.toISOString(),
            },
            p_canal: 'painel_interno',
          });

          console.log(`⏸️ Ticket ${ticket.codigo_ticket} - SLA pausado (${timeRemaining} min restantes)`);
        }
      }

      console.log(`✅ SLAs pausados: ${pausedCount} tickets`);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'pause',
          tickets_pausados: pausedCount,
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'resume') {
      // ========================================
      // DESPAUSAR SLA (às 8h30)
      // ========================================
      
      // Buscar tickets pausados (apenas os que devem ser despausados)
      const { data: ticketsToResume, error: fetchError } = await supabase
        .from('tickets')
        .select('id, codigo_ticket, data_limite_sla, sla_pausado_em, tempo_pausado_total, data_abertura, status')
        .eq('sla_pausado', true)
        .in('status', ['aberto', 'em_atendimento', 'aguardando_resposta'])
        .not('sla_pausado_em', 'is', null);

      if (fetchError) {
        console.error('❌ Erro ao buscar tickets para despausar:', fetchError);
        throw fetchError;
      }

      console.log(`📊 Tickets a despausar: ${ticketsToResume?.length || 0}`);

      let resumedCount = 0;

      if (ticketsToResume && ticketsToResume.length > 0) {
        for (const ticket of ticketsToResume) {
          const now = new Date();
          const pausedAt = new Date(ticket.sla_pausado_em);
          
          // Calcular tempo pausado (em minutos)
          const minutesPaused = calculatePausedTime(pausedAt, now);
          
          // Converter tempo pausado total existente para minutos
          const existingPausedMinutes = parseInterval(ticket.tempo_pausado_total || '0 seconds');
          const totalPausedMinutes = existingPausedMinutes + minutesPaused;

          // Calcular nova data limite SLA
          const currentSlaLimit = new Date(ticket.data_limite_sla);
          const newSlaLimit = new Date(currentSlaLimit.getTime() + minutesPaused * 60 * 1000);

          // Recalcular sla_half_time baseado no SLA efetivo (sem tempo pausado)
          const createdAt = new Date(ticket.data_abertura);
          
          // Calcular SLA total original em minutos
          const totalSlaMinutes = (newSlaLimit.getTime() - createdAt.getTime()) / (1000 * 60);
          
          // SLA efetivo = SLA total - tempo pausado acumulado
          const effectiveSlaMinutes = totalSlaMinutes - totalPausedMinutes;
          
          // 50% do SLA efetivo
          const halfSlaTime = new Date(createdAt.getTime() + (effectiveSlaMinutes / 2) * 60 * 1000);

          // Log detalhado para debugging
          console.log(`📊 SLA Calculation for ${ticket.codigo_ticket}:`);
          console.log(`  - Data abertura: ${createdAt.toISOString()}`);
          console.log(`  - Total SLA: ${totalSlaMinutes.toFixed(2)} min`);
          console.log(`  - Tempo pausado acumulado: ${totalPausedMinutes} min`);
          console.log(`  - SLA efetivo: ${effectiveSlaMinutes.toFixed(2)} min`);
          console.log(`  - 50% do SLA efetivo: ${(effectiveSlaMinutes / 2).toFixed(2)} min`);
          console.log(`  - sla_half_time calculado: ${halfSlaTime.toISOString()}`);
          console.log(`  - data_limite_sla: ${newSlaLimit.toISOString()}`);

          // Despausar ticket
          const { error: updateError } = await supabase
            .from('tickets')
            .update({
              sla_pausado: false,
              sla_pausado_em: null,
              data_limite_sla: newSlaLimit.toISOString(),
              sla_half_time: halfSlaTime.toISOString(),
              tempo_pausado_total: `${totalPausedMinutes} minutes`,
            })
            .eq('id', ticket.id);

          if (updateError) {
            console.error(`❌ Erro ao despausar ticket ${ticket.codigo_ticket}:`, updateError);
            continue;
          }

          resumedCount++;

          // Log da ação
          await supabase.rpc('log_system_action', {
            p_tipo_log: 'sistema',
            p_entidade_afetada: 'tickets_sla',
            p_entidade_id: ticket.id,
            p_acao_realizada: `SLA despausado - Início do expediente (8h30)`,
            p_dados_novos: {
              tempo_pausado_minutos: minutesPaused,
              tempo_pausado_total_minutos: totalPausedMinutes,
              nova_data_limite_sla: newSlaLimit.toISOString(),
            },
            p_canal: 'painel_interno',
          });

          console.log(`▶️ Ticket ${ticket.codigo_ticket} - SLA despausado (+${minutesPaused} min)`);
        }
      }

      console.log(`✅ SLAs despausados: ${resumedCount} tickets`);

      return new Response(
        JSON.stringify({
          success: true,
          action: 'resume',
          tickets_despausados: resumedCount,
          timestamp: new Date().toISOString(),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação inválida. Use "pause" ou "resume".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Parse PostgreSQL interval to minutes
 */
function parseInterval(interval: string): number {
  if (!interval || interval === '0 seconds') return 0;
  
  const parts = interval.split(' ');
  let totalMinutes = 0;
  
  for (let i = 0; i < parts.length; i += 2) {
    const value = parseInt(parts[i]);
    const unit = parts[i + 1];
    
    if (unit?.startsWith('day')) {
      totalMinutes += value * 24 * 60;
    } else if (unit?.startsWith('hour')) {
      totalMinutes += value * 60;
    } else if (unit?.startsWith('min')) {
      totalMinutes += value;
    }
  }
  
  return totalMinutes;
}
