// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log('🔍 Iniciando teste de detecção de crise...');

    // 1. Buscar tickets recentes similares
    const { data: recentTickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, titulo, descricao_problema, created_at, equipe_responsavel_id, status')
      .gte('created_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) // Últimas 2 horas
      .order('created_at', { ascending: false });

    if (ticketsError) {
      throw new Error(`Erro ao buscar tickets: ${ticketsError.message}`);
    }

    console.log(`📋 Encontrados ${recentTickets?.length || 0} tickets nas últimas 2 horas`);

    // 2. Agrupar por descrição similar
    const ticketGroups = new Map();
    
    recentTickets?.forEach(ticket => {
      const key = ticket.descricao_problema.toLowerCase().trim();
      if (!ticketGroups.has(key)) {
        ticketGroups.set(key, []);
      }
      ticketGroups.get(key).push(ticket);
    });

    // 3. Encontrar grupos com 5+ tickets
    const largeGroups = Array.from(ticketGroups.entries())
      .filter(([_, tickets]) => tickets.length >= 5)
      .sort((a, b) => b[1].length - a[1].length);

    console.log(`🎯 Encontrados ${largeGroups.length} grupos com 5+ tickets similares`);

    // 4. Para cada grupo grande, verificar se já existe crise
    const results = [];
    
    for (const [description, tickets] of largeGroups) {
      console.log(`\n📋 Analisando grupo: "${description}" (${tickets.length} tickets)`);
      
      // Verificar se já existe crise para estes tickets
      const ticketIds = tickets.map(t => t.id);
      const { data: existingLinks } = await supabase
        .from('crise_ticket_links')
        .select('crise_id, crises(id, titulo, status)')
        .in('ticket_id', ticketIds);

      const hasActiveCrisis = existingLinks?.some(link => 
        link.crises && typeof link.crises === 'object' && 
        'status' in link.crises && 
        ['aberto', 'investigando', 'comunicado', 'mitigado'].includes(link.crises.status)
      );

      if (hasActiveCrisis) {
        console.log('✅ Já existe crise ativa para este grupo');
        results.push({
          description,
          ticketCount: tickets.length,
          status: 'crisis_exists',
          message: 'Crise já existe'
        });
        continue;
      }

      // 5. Criar crise automaticamente
      console.log('🚨 Criando nova crise para este grupo...');
      
      const firstTicket = tickets[0];
      const crisisTitle = `Crise automática: ${description.substring(0, 50)}...`;
      
      const { data: newCrisis, error: crisisError } = await supabase
        .from('crises')
        .insert({
          titulo: crisisTitle,
          descricao: `Crise detectada automaticamente devido a ${tickets.length} tickets similares`,
          status: 'aberto',
          equipe_id: firstTicket.equipe_responsavel_id,
          abriu_por: firstTicket.criado_por || null,
          palavras_chave: [description.split(' ')[0], 'sistema', 'problema']
        })
        .select()
        .single();

      if (crisisError) {
        console.error('❌ Erro ao criar crise:', crisisError);
        results.push({
          description,
          ticketCount: tickets.length,
          status: 'error',
          message: `Erro ao criar crise: ${crisisError.message}`
        });
        continue;
      }

      console.log(`✅ Crise criada: ${newCrisis.id}`);

      // 6. Vincular todos os tickets à crise
      const linkData = tickets.map(ticket => ({
        crise_id: newCrisis.id,
        ticket_id: ticket.id,
        linked_by: firstTicket.criado_por || null
      }));

      const { error: linkError } = await supabase
        .from('crise_ticket_links')
        .insert(linkData);

      if (linkError) {
        console.error('❌ Erro ao vincular tickets:', linkError);
      } else {
        console.log(`🔗 ${tickets.length} tickets vinculados à crise`);
      }

      // 7. Atualizar prioridade dos tickets para crise
      const { error: updateError } = await supabase
        .from('tickets')
        .update({ prioridade: 'crise' })
        .in('id', ticketIds);

      if (updateError) {
        console.error('❌ Erro ao atualizar prioridade:', updateError);
      }

      results.push({
        description,
        ticketCount: tickets.length,
        crisisId: newCrisis.id,
        status: 'crisis_created',
        message: `Crise criada e ${tickets.length} tickets vinculados`
      });
    }

    // 8. Resultado final
    const summary = {
      totalTicketsAnalyzed: recentTickets?.length || 0,
      groupsFound: ticketGroups.size,
      largeGroupsFound: largeGroups.length,
      crisesCreated: results.filter(r => r.status === 'crisis_created').length,
      results
    };

    console.log('📊 Resumo da análise:', summary);

    return new Response(JSON.stringify({
      success: true,
      summary,
      message: `Análise completa: ${summary.crisesCreated} novas crises criadas de ${summary.largeGroupsFound} grupos encontrados`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro na detecção de crise:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      details: 'Verifique os logs para mais detalhes'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});