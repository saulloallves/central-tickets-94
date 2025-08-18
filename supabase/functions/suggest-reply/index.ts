import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const openaiApiKey = Deno.env.get('OPENAI_API_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { ticketId } = await req.json();
    
    if (!ticketId) {
      throw new Error('ticketId is required');
    }

    console.log('Generating AI suggestion for ticket:', ticketId);

    // 1. Fetch ticket details
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select(`
        *,
        unidades(id, grupo),
        colaboradores(nome_completo, email),
        franqueados(name, email)
      `)
      .eq('id', ticketId)
      .single();

    if (ticketError || !ticket) {
      throw new Error('Ticket not found');
    }

    // 2. Fetch recent messages for context
    const { data: messages } = await supabase
      .from('ticket_mensagens')
      .select('mensagem, direcao, created_at')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: false })
      .limit(5);

    // 3. Fetch knowledge articles (prioritize by category)
    const { data: knowledgeArticles } = await supabase
      .from('knowledge_articles')
      .select('titulo, conteudo, categoria')
      .eq('ativo', true)
      .or(`categoria.eq.${ticket.categoria},categoria.is.null`)
      .limit(10);

    // 4. Fetch similar recent tickets from same unit
    const { data: similarTickets } = await supabase
      .from('tickets')
      .select('descricao_problema, resposta_resolucao, prioridade, status, resolvido_em')
      .eq('unidade_id', ticket.unidade_id)
      .neq('id', ticketId)
      .not('resposta_resolucao', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    // 5. Fetch AI settings
    const { data: aiSettings } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .single();

    if (!aiSettings) {
      throw new Error('AI settings not found');
    }

    // 6. Build context for AI
    const contextSections = [];
    
    contextSections.push(`INFORMAÇÕES DO TICKET:
- Código: ${ticket.codigo_ticket}
- Unidade: ${ticket.unidades?.grupo || ticket.unidade_id}
- Categoria: ${ticket.categoria || 'Não especificada'}
- Prioridade: ${ticket.prioridade}
- Status: ${ticket.status}
- Descrição: ${ticket.descricao_problema}
- Reaberto: ${ticket.reaberto_count} vez(es)`);

    if (messages && messages.length > 0) {
      contextSections.push(`HISTÓRICO DE MENSAGENS:
${messages.map(m => `[${m.direcao}] ${m.mensagem}`).join('\n')}`);
    }

    if (knowledgeArticles && knowledgeArticles.length > 0) {
      contextSections.push(`BASE DE CONHECIMENTO:
${knowledgeArticles.map(a => `${a.titulo}: ${a.conteudo.substring(0, 300)}...`).join('\n\n')}`);
    }

    if (similarTickets && similarTickets.length > 0) {
      contextSections.push(`TICKETS SIMILARES DA UNIDADE:
${similarTickets.map(t => `Problema: ${t.descricao_problema.substring(0, 100)}...\nResolução: ${t.resposta_resolucao?.substring(0, 150)}...`).join('\n\n')}`);
    }

    const context = contextSections.join('\n\n');

    // 7. Build AI prompt
    const systemPrompt = `${aiSettings.base_conhecimento_prompt}

Estilo de resposta: ${aiSettings.estilo_resposta}

Regras:
- Seja ${aiSettings.estilo_resposta.toLowerCase()} e profissional
- Use informações da base de conhecimento e tickets similares quando relevante
- Forneça uma resposta clara e acionável
- Se necessário, sugira próximos passos
- Mantenha o tom adequado ao contexto da franquia`;

    const userPrompt = `Com base no contexto abaixo, sugira uma resposta profissional para este ticket:

${context}

Gere uma sugestão de resposta que o atendente possa usar diretamente ou adaptar.`;

    // 8. Call OpenAI
    const model = aiSettings.modelo_sugestao || 'gpt-4o-mini';
    const isNewerModel = model.includes('gpt-4.1') || model.includes('gpt-5') || model.includes('o3') || model.includes('o4');
    
    const requestBody: any = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
    };

    if (isNewerModel) {
      requestBody.max_completion_tokens = aiSettings.max_tokens || 800;
    } else {
      requestBody.max_tokens = aiSettings.max_tokens || 800;
      requestBody.temperature = aiSettings.temperatura || 0.3;
      requestBody.top_p = aiSettings.top_p || 1.0;
    }

    console.log('Calling OpenAI with model:', model);

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    const suggestionText = openaiData.choices[0].message.content;

    // 9. Save to database
    const { data: suggestion, error: saveError } = await supabase
      .from('ticket_ai_interactions')
      .insert({
        ticket_id: ticketId,
        kind: 'suggestion',
        resposta: suggestionText,
        model,
        params: requestBody,
        log: {
          prompt: userPrompt,
          system_prompt: systemPrompt,
          context_sections: contextSections.length,
          openai_response: openaiData
        }
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving suggestion:', saveError);
      throw saveError;
    }

    console.log('AI suggestion generated successfully');

    return new Response(JSON.stringify({
      suggestionId: suggestion.id,
      resposta: suggestionText
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in suggest-reply function:', error);
    return new Response(JSON.stringify({ 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});