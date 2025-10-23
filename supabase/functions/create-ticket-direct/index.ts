import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DirectTicketRequest {
  titulo?: string;
  descricao_problema: string;
  codigo_grupo: string;
  equipe_id?: string;
  equipe_nome?: string;
  prioridade?: 'baixo' | 'medio' | 'alto' | 'imediato' | 'crise';
  categoria?: string;
  franqueado_id?: string;
}

// ========================================
// HELPER FUNCTIONS (copiadas de typebot-webhook)
// ========================================

async function getActiveTeams(supabase: any) {
  const { data: equipes, error: equipesError } = await supabase
    .from('equipes')
    .select('id, nome, introducao, descricao')
    .eq('ativo', true)
    .order('nome');

  if (equipesError) {
    console.error('Error fetching teams:', equipesError);
    return [];
  }

  return equipes || [];
}

async function findTeamByNameDirect(supabase: any, teamName: string) {
  const cleanTeamName = teamName.replace(/:\s*[A-Z]$/, '').trim();
  
  // First try exact match with original name
  let { data: equipe } = await supabase
    .from('equipes')
    .select('id, nome')
    .eq('ativo', true)
    .ilike('nome', teamName)
    .maybeSingle();
  
  // Try exact match with cleaned name
  if (!equipe) {
    const { data: equipeClean } = await supabase
      .from('equipes')
      .select('id, nome')
      .eq('ativo', true)
      .ilike('nome', cleanTeamName)
      .maybeSingle();
    
    equipe = equipeClean;
  }
  
  // If not found, try partial match with cleaned name
  if (!equipe) {
    const { data: equipes } = await supabase
      .from('equipes')
      .select('id, nome')
      .eq('ativo', true)
      .ilike('nome', `%${cleanTeamName}%`)
      .limit(1);
    
    equipe = equipes?.[0] || null;
  }
  
  return equipe;
}

async function openAIRequest(path: string, payload: any) {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response;
}

async function classifyTeamOnly(
  supabase: any, 
  message: string, 
  equipes: any[], 
  existingData: any = {}
): Promise<{ equipe_responsavel: string | null; justificativa: string; } | null> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey || !equipes || equipes.length === 0) {
    return null;
  }

  try {
    console.log('Iniciando análise IA apenas para equipe...');
    
    const { data: aiSettings } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .maybeSingle();

    const modelToUse = aiSettings?.modelo_classificacao || 'gpt-4o-mini';
    
    const equipesInfo = equipes.map(e => 
      `- ${e.nome}: ${e.descricao || 'Sem descrição'} (Introdução: ${e.introducao || 'N/A'})`
    ).join('\n');

    const existingInfo = Object.keys(existingData).length > 0 ? 
      `\nDados já definidos: ${JSON.stringify(existingData, null, 2)}` : '';

    const prompt = `Você é um especialista em classificação de tickets de suporte.

Analise a descrição do problema e determine APENAS qual equipe é mais adequada para resolver este ticket.

Descrição do problema: "${message}"${existingInfo}

Equipes disponíveis:
${equipesInfo}

IMPORTANTE: Se você NÃO TIVER CERTEZA sobre qual equipe escolher, ou se o problema não se encaixar claramente em nenhuma equipe específica, escolha "Concierge Operação". Esta equipe está preparada para analisar e redirecionar tickets incertos.

Responda APENAS com um JSON válido no formato:
{
  "equipe_responsavel": "nome_da_equipe_escolhida",
  "justificativa": "explicação de 1-2 frases do porquê desta equipe",
  "confianca": "alta, media ou baixa"
}

Escolha a equipe que melhor se adequa ao problema descrito. Use "Concierge Operação" quando em dúvida.`;

    const response = await openAIRequest('chat/completions', {
      model: modelToUse,
      messages: [
        { role: 'system', content: 'Você é um especialista em classificação de tickets. Responda apenas com JSON válido.' },
        { role: 'user', content: prompt }
      ],
      max_completion_tokens: 300,
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    const result = JSON.parse(content.trim());
    
    // Se a IA não retornou equipe ou está com baixa confiança, usar Concierge Operação
    if (!result.equipe_responsavel || result.confianca === 'baixa') {
      console.log('IA incerta ou sem equipe - direcionando para Concierge Operação');
      return {
        equipe_responsavel: 'Concierge Operação',
        justificativa: result.justificativa || 'Ticket requer análise adicional para direcionamento correto'
      };
    }

    console.log('Resultado da classificação de equipe:', result);
    return result;

  } catch (error) {
    console.error('Erro na classificação de equipe por IA:', error);
    return {
      equipe_responsavel: 'Concierge Operação',
      justificativa: 'Erro na classificação automática - requer análise manual'
    };
  }
}

async function classifyTicket(
  supabase: any,
  message: string, 
  equipes: any[]
): Promise<{ prioridade: string; titulo: string; equipe_responsavel: string | null; justificativa: string; } | null> {
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (!openaiApiKey || !equipes || equipes.length === 0) {
    return null;
  }

  try {
    console.log('Iniciando análise IA completa...');
    
    const { data: aiSettings } = await supabase
      .from('faq_ai_settings')
      .select('*')
      .eq('ativo', true)
      .maybeSingle();

    const modelToUse = aiSettings?.modelo_classificacao || 'gpt-4o-mini';
    
    const equipesInfo = equipes.map(e => 
      `- ${e.nome}: ${e.descricao || e.introducao || 'Sem descrição'}`
    ).join('\n');

    const prompt = `Você é um especialista em classificação de tickets de suporte.

Analise este ticket e forneça:

1. TÍTULO: Crie um título DESCRITIVO de exatamente 3 palavras que resuma o problema.
2. PRIORIDADE: baixo, medio, alto, imediato, crise
3. EQUIPE: Escolha a melhor equipe ou use "Concierge Operação" se não tiver certeza.

Descrição do problema: "${message}"

Equipes disponíveis:
${equipesInfo}

Responda APENAS com JSON válido:
{
  "prioridade": "baixo|medio|alto|imediato|crise",
  "titulo": "Título de 3 palavras",
  "equipe_responsavel": "nome_da_equipe",
  "justificativa": "Breve explicação",
  "confianca": "alta|media|baixa"
}`;

    const response = await openAIRequest('chat/completions', {
      model: modelToUse,
      messages: [
        { role: 'system', content: 'Você é um especialista em classificação de tickets. Responda apenas com JSON válido.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 500,
      temperature: 0.1,
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Resposta vazia da IA');
    }

    let cleanedContent = content.trim();
    if (content.includes('```json')) {
      cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '').trim();
    } else if (content.includes('```')) {
      cleanedContent = content.replace(/```\s*/g, '').trim();
    }

    const result = JSON.parse(cleanedContent);
    
    // Validar e normalizar prioridade
    const validPriorities = ['baixo', 'medio', 'alto', 'imediato', 'crise'];
    if (!validPriorities.includes(result.prioridade)) {
      console.warn(`⚠️ Prioridade inválida "${result.prioridade}", usando "baixo"`);
      result.prioridade = 'baixo';
    }

    // Garantir título com 3 palavras
    let titulo = 'Novo Ticket';
    if (result.titulo) {
      const cleanTitle = result.titulo.trim().replace(/[.,!?;:"']+/g, '');
      const words = cleanTitle.split(/\s+/).filter(word => word.length > 0);
      titulo = words.slice(0, 3).join(' ');
    }

    // Se baixa confiança, usar Concierge Operação
    let equipeNome = result.equipe_responsavel;
    if (!equipeNome || result.confianca === 'baixa') {
      equipeNome = 'Concierge Operação';
    }

    console.log('✅ IA classificou:', { prioridade: result.prioridade, titulo, equipe: equipeNome });

    return {
      prioridade: result.prioridade,
      titulo,
      equipe_responsavel: equipeNome,
      justificativa: result.justificativa || 'Análise automática'
    };

  } catch (error) {
    console.error('Erro na classificação por IA:', error);
    return null;
  }
}

// ========================================
// MAIN HANDLER
// ========================================

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Parse request body
    const body: DirectTicketRequest = await req.json();
    
    console.log('[create-ticket-direct] Received request:', {
      titulo: body.titulo,
      codigo_grupo: body.codigo_grupo,
      prioridade: body.prioridade,
      equipe_id: body.equipe_id,
      equipe_nome: body.equipe_nome,
    });

    // Validate required fields
    if (!body.descricao_problema || !body.codigo_grupo) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Campos obrigatórios: descricao_problema, codigo_grupo',
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Buscar unidade pelo codigo_grupo
    const { data: unidade, error: unidadeError } = await supabase
      .from('unidades')
      .select('id, grupo, codigo_grupo')
      .eq('codigo_grupo', body.codigo_grupo)
      .single();

    if (unidadeError || !unidade) {
      console.error('[create-ticket-direct] Unidade não encontrada:', body.codigo_grupo);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Unidade com codigo_grupo "${body.codigo_grupo}" não encontrada`,
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[create-ticket-direct] Unidade encontrada:', {
      id: unidade.id,
      grupo: unidade.grupo,
      codigo_grupo: unidade.codigo_grupo,
    });

    // Inicializar variáveis de classificação
    let titulo = body.titulo;
    let prioridade = body.prioridade;
    let equipe_responsavel_id = body.equipe_id;

    // DECISÃO: Precisa usar IA?
    const temPrioridade = !!body.prioridade;
    const temEquipe = !!(body.equipe_id || body.equipe_nome);

    console.log('[create-ticket-direct] 🧠 Decisão de classificação:', {
      tem_prioridade: temPrioridade,
      tem_equipe: temEquipe,
      vai_usar_ia: !temPrioridade || !temEquipe
    });

    // Se forneceu nome da equipe, buscar UUID
    if (body.equipe_nome && !equipe_responsavel_id) {
      console.log('[create-ticket-direct] 🔍 Buscando equipe por nome:', body.equipe_nome);
      const equipeEncontrada = await findTeamByNameDirect(supabase, body.equipe_nome);
      if (equipeEncontrada) {
        equipe_responsavel_id = equipeEncontrada.id;
        console.log('[create-ticket-direct] ✅ Equipe encontrada:', equipeEncontrada.nome);
      } else {
        console.warn('[create-ticket-direct] ⚠️ Equipe não encontrada:', body.equipe_nome);
      }
    }

    // CLASSIFICAÇÃO CONDICIONAL POR IA
    if (!temPrioridade || !equipe_responsavel_id) {
      console.log('[create-ticket-direct] 🤖 Iniciando classificação por IA...');
      
      // Buscar equipes disponíveis
      const equipes = await getActiveTeams(supabase);
      
      if (equipes && equipes.length > 0) {
        
        // CENÁRIO 1: Falta tudo (prioridade E equipe)
        if (!temPrioridade && !equipe_responsavel_id) {
          console.log('[create-ticket-direct] 📊 IA vai classificar: PRIORIDADE + EQUIPE');
          
          const aiResult = await classifyTicket(supabase, body.descricao_problema, equipes);
          
          if (aiResult) {
            prioridade = aiResult.prioridade;
            if (!titulo) titulo = aiResult.titulo;
            
            // Buscar UUID da equipe pelo nome retornado
            if (aiResult.equipe_responsavel) {
              const equipeEncontrada = await findTeamByNameDirect(supabase, aiResult.equipe_responsavel);
              if (equipeEncontrada) {
                equipe_responsavel_id = equipeEncontrada.id;
              }
            }
            
            console.log('[create-ticket-direct] ✅ IA classificou:', {
              titulo,
              prioridade,
              equipe: aiResult.equipe_responsavel,
              justificativa: aiResult.justificativa
            });
          }
        }
        
        // CENÁRIO 2: Tem prioridade, falta só equipe
        else if (temPrioridade && !equipe_responsavel_id) {
          console.log('[create-ticket-direct] 📊 IA vai classificar apenas: EQUIPE');
          
          const existingData = {
            prioridade: body.prioridade,
            titulo: body.titulo
          };
          
          const teamResult = await classifyTeamOnly(
            supabase,
            body.descricao_problema, 
            equipes, 
            existingData
          );
          
          if (teamResult && teamResult.equipe_responsavel) {
            const equipeEncontrada = await findTeamByNameDirect(supabase, teamResult.equipe_responsavel);
            if (equipeEncontrada) {
              equipe_responsavel_id = equipeEncontrada.id;
              console.log('[create-ticket-direct] ✅ IA definiu equipe:', equipeEncontrada.nome);
            }
          }
        }
        
        // CENÁRIO 3: Tem equipe, falta só prioridade
        else if (!temPrioridade && equipe_responsavel_id) {
          console.log('[create-ticket-direct] 📊 IA vai classificar apenas: PRIORIDADE');
          
          const aiResult = await classifyTicket(supabase, body.descricao_problema, equipes);
          
          if (aiResult) {
            prioridade = aiResult.prioridade;
            if (!titulo) titulo = aiResult.titulo;
            
            console.log('[create-ticket-direct] ✅ IA definiu prioridade:', prioridade);
          }
        }
        
      } else {
        console.warn('[create-ticket-direct] ⚠️ Nenhuma equipe ativa encontrada');
      }
      
      // Fallbacks se IA falhar
      if (!prioridade) {
        prioridade = 'baixo';
        console.log('[create-ticket-direct] ⚠️ Fallback: prioridade = baixo');
      }
      
      if (!titulo) {
        titulo = body.descricao_problema.split(' ').slice(0, 3).join(' ');
        console.log('[create-ticket-direct] ⚠️ Fallback: titulo gerado');
      }
      
    } else {
      console.log('[create-ticket-direct] 📝 Modo direto: usando dados fornecidos (SEM IA)');
    }

    // Prepare ticket data
    const ticketData: any = {
      titulo: titulo || 'Novo Ticket',
      descricao_problema: body.descricao_problema,
      unidade_id: unidade.id,
      prioridade: prioridade || 'baixo',
      status: 'aberto',
      data_abertura: new Date().toISOString(),
      canal_origem: 'typebot',
    };

    // Add optional fields if provided
    if (equipe_responsavel_id) {
      ticketData.equipe_responsavel_id = equipe_responsavel_id;
    }
    if (body.categoria) {
      ticketData.categoria = body.categoria;
    }
    if (body.franqueado_id) {
      ticketData.franqueado_id = body.franqueado_id;
    }

    console.log('[create-ticket-direct] Creating ticket:', ticketData);

    // Insert ticket directly into database
    const { data: ticket, error: insertError } = await supabase
      .from('tickets')
      .insert([ticketData])
      .select()
      .single();

    if (insertError) {
      console.error('[create-ticket-direct] Error creating ticket:', insertError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Erro ao criar ticket',
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[create-ticket-direct] Ticket created successfully:', ticket.id);

    // Add initial message
    const { error: messageError } = await supabase
      .from('ticket_mensagens')
      .insert([{
        ticket_id: ticket.id,
        mensagem: body.descricao_problema,
        direcao: 'entrada',
        canal: 'sistema',
        anexos: [],
        created_at: new Date().toISOString(),
      }]);

    if (messageError) {
      console.warn('[create-ticket-direct] Error adding initial message:', messageError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        ticket,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('[create-ticket-direct] Unexpected error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Erro inesperado ao criar ticket',
        details: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
