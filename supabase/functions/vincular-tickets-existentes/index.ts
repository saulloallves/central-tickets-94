import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔗 Iniciando processo de vinculação de tickets existentes...');

    // Buscar tickets não vinculados das últimas 24 horas relacionados ao Girabot
    const { data: unlinkedTickets } = await supabase
      .from('tickets')
      .select(`
        id, 
        codigo_ticket, 
        titulo, 
        descricao_problema, 
        prioridade,
        equipe_responsavel_id,
        created_at
      `)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .or('descricao_problema.ilike.%girabot%,descricao_problema.ilike.%fluxo%,titulo.ilike.%girabot%,titulo.ilike.%fluxo%')
      .is('crise_ticket_links.crise_id', null)
      .order('created_at', { ascending: false });

    if (!unlinkedTickets || unlinkedTickets.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'Nenhum ticket não vinculado encontrado',
        linked_count: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`📋 Encontrados ${unlinkedTickets.length} tickets não vinculados relacionados ao Girabot`);

    // Buscar crise ativa mais recente
    const { data: activeCrisis } = await supabase
      .from('crises')
      .select('id, titulo, palavras_chave, created_at')
      .eq('is_active', true)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);

    let targetCrisisId: string;
    
    if (activeCrisis && activeCrisis.length > 0) {
      targetCrisisId = activeCrisis[0].id;
      console.log(`🎯 Usando crise existente: ${activeCrisis[0].titulo} (${targetCrisisId})`);
    } else {
      // Criar nova crise para agrupar todos os tickets
      const { data: newCrisis } = await supabase
        .from('crises')
        .insert({
          titulo: 'Crise Girabot - Agrupamento Automático',
          descricao: 'Crise criada automaticamente para agrupar tickets relacionados ao Girabot',
          palavras_chave: ['girabot', 'fluxo', 'parei', 'parou'],
          status: 'aberto',
          is_active: true,
          equipe_id: unlinkedTickets[0]?.equipe_responsavel_id
        })
        .select('id')
        .single();

      if (!newCrisis) {
        throw new Error('Falha ao criar nova crise');
      }

      targetCrisisId = newCrisis.id;
      console.log(`🆕 Nova crise criada: ${targetCrisisId}`);
    }

    // Vincular tickets à crise usando análise de similaridade
    let linkedCount = 0;
    const linkedTickets: any[] = [];

    for (const ticket of unlinkedTickets) {
      const shouldLink = analyzeTicketSimilarity(ticket, unlinkedTickets);
      
      if (shouldLink) {
        // Verificar se já não está vinculado
        const { data: existingLink } = await supabase
          .from('crise_ticket_links')
          .select('id')
          .eq('ticket_id', ticket.id)
          .eq('crise_id', targetCrisisId)
          .single();

        if (!existingLink) {
          const { error: linkError } = await supabase
            .from('crise_ticket_links')
            .insert({
              crise_id: targetCrisisId,
              ticket_id: ticket.id,
              linked_by: null // Sistema automático
            });

          if (!linkError) {
            // Atualizar prioridade para crise se ainda não for
            if (ticket.prioridade !== 'crise') {
              await supabase
                .from('tickets')
                .update({ prioridade: 'crise' })
                .eq('id', ticket.id);
            }

            linkedCount++;
            linkedTickets.push({
              id: ticket.id,
              codigo: ticket.codigo_ticket,
              titulo: ticket.titulo,
              descricao: ticket.descricao_problema
            });

            console.log(`✅ Ticket vinculado: ${ticket.codigo_ticket} - ${ticket.titulo}`);
          }
        }
      }
    }

    // Atualizar contador da crise
    const { data: ticketCount } = await supabase
      .from('crise_ticket_links')
      .select('ticket_id', { count: 'exact' })
      .eq('crise_id', targetCrisisId);

    await supabase
      .from('crises')
      .update({ 
        tickets_count: ticketCount?.length || 0,
        updated_at: new Date().toISOString()
      })
      .eq('id', targetCrisisId);

    console.log(`🎉 Processo concluído: ${linkedCount} tickets vinculados à crise ${targetCrisisId}`);

    return new Response(JSON.stringify({
      success: true,
      crise_id: targetCrisisId,
      linked_count: linkedCount,
      linked_tickets: linkedTickets,
      message: `${linkedCount} tickets vinculados com sucesso`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Erro no processo de vinculação:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: 'Erro interno no processo de vinculação'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Função para analisar similaridade de tickets
function analyzeTicketSimilarity(ticket: any, allTickets: any[]): boolean {
  const description = (ticket.descricao_problema || '').toLowerCase();
  const title = (ticket.titulo || '').toLowerCase();
  
  // Palavras-chave específicas do Girabot
  const girabotKeywords = ['girabot', 'fluxo', 'parei', 'parou', 'travou', 'falha'];
  
  // Verificar se tem palavras-chave do Girabot
  const hasGirabotKeywords = girabotKeywords.some(keyword => 
    description.includes(keyword) || title.includes(keyword)
  );
  
  if (!hasGirabotKeywords) {
    return false;
  }
  
  // Contar tickets similares na mesma janela de tempo
  const timeWindow = 2 * 60 * 60 * 1000; // 2 horas
  const ticketTime = new Date(ticket.created_at).getTime();
  
  const similarInWindow = allTickets.filter(otherTicket => {
    if (otherTicket.id === ticket.id) return false;
    
    const otherTime = new Date(otherTicket.created_at).getTime();
    const timeDiff = Math.abs(ticketTime - otherTime);
    
    if (timeDiff > timeWindow) return false;
    
    const otherDescription = (otherTicket.descricao_problema || '').toLowerCase();
    const otherTitle = (otherTicket.titulo || '').toLowerCase();
    
    // Verificar se tem palavras similares
    return girabotKeywords.some(keyword => 
      otherDescription.includes(keyword) || otherTitle.includes(keyword)
    );
  });
  
  // Vincular se há pelo menos 2 tickets similares (incluindo este)
  const shouldLink = similarInWindow.length >= 1;
  
  console.log(`🔍 Ticket ${ticket.codigo_ticket}: ${shouldLink ? 'VINCULAR' : 'IGNORAR'} (${similarInWindow.length} similares)`);
  
  return shouldLink;
}