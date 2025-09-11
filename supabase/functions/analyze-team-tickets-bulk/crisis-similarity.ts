interface TicketForAnalysis {
  id: string;
  codigo_ticket: string;
  titulo: string;
  descricao_problema: string;
  categoria?: string;
  data_abertura: string;
  unidade_id: string;
  prioridade: string;
}

async function findSimilarTicketsForCrisis(
  apiKey: string,
  crise: any,
  tickets: TicketForAnalysis[]
): Promise<TicketForAnalysis[]> {
  
  if (!tickets || tickets.length === 0) {
    return [];
  }

  // Usar palavras-chave da crise para filtrar
  const crisisKeywords = crise.similar_terms || [];
  
  // Se não tem keywords, usar análise por título
  if (crisisKeywords.length === 0) {
    return [];
  }

  const ticketsForAnalysis = tickets.map(ticket => ({
    id: ticket.id,
    codigo: ticket.codigo_ticket,
    titulo: ticket.titulo,
    descricao: ticket.descricao_problema,
    categoria: ticket.categoria || 'N/A'
  }));

  const systemPrompt = `Você é um analista especializado em identificar se tickets são similares a uma crise existente.

Analise se os tickets fornecidos são relacionados ao mesmo problema da crise existente.

Critérios:
1. Mesmo sistema/funcionalidade afetada
2. Sintomas similares 
3. Causa raiz relacionada
4. Timing próximo

Seja conservador - só vincule se há alta confiança de que é o mesmo problema.`;

  const userPrompt = `CRISE EXISTENTE:
Título: ${crise.titulo}
Palavras-chave: ${crisisKeywords.join(', ')}

TICKETS PARA ANÁLISE:
${JSON.stringify(ticketsForAnalysis, null, 2)}

Responda APENAS com um JSON:
{
  "similar_tickets": [
    {
      "ticket_id": "id_do_ticket",
      "confidence": 0.95,
      "reasoning": "Por que este ticket é similar à crise"
    }
  ]
}

Só inclua tickets com confiança > 0.8`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        response_format: { type: "json_object" }
      }),
    });

    if (!response.ok) {
      console.error(`Erro na API OpenAI para análise de crise: ${response.statusText}`);
      return [];
    }

    const data = await response.json();
    const analysis = JSON.parse(data.choices[0].message.content);
    
    const similarTicketIds = analysis.similar_tickets
      ?.filter(t => t.confidence > 0.8)
      ?.map(t => t.ticket_id) || [];
    
    const similarTickets = tickets.filter(t => similarTicketIds.includes(t.id));
    
    console.log(`🎯 Crise "${crise.titulo}": ${similarTickets.length} tickets similares encontrados`);
    
    return similarTickets;
  } catch (error) {
    console.error('Erro na análise de similaridade com crise:', error);
    return [];
  }
}

export { findSimilarTicketsForCrisis };