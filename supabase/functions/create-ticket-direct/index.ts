import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { classifyTicket, classifyTeamOnly } from '../typebot-webhook/ai-classifier.ts';
import { getActiveTeams, findTeamByNameDirect } from '../typebot-webhook/ticket-creator.ts';

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
      const equipeEncontrada = await findTeamByNameDirect(body.equipe_nome);
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
      const equipes = await getActiveTeams();
      
      if (equipes && equipes.length > 0) {
        
        // CENÁRIO 1: Falta tudo (prioridade E equipe)
        if (!temPrioridade && !equipe_responsavel_id) {
          console.log('[create-ticket-direct] 📊 IA vai classificar: PRIORIDADE + EQUIPE');
          
          const aiResult = await classifyTicket(body.descricao_problema, equipes);
          
          if (aiResult) {
            prioridade = aiResult.prioridade;
            if (!titulo) titulo = aiResult.titulo;
            
            // Buscar UUID da equipe pelo nome retornado
            if (aiResult.equipe_responsavel) {
              const equipeEncontrada = await findTeamByNameDirect(aiResult.equipe_responsavel);
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
            body.descricao_problema, 
            equipes, 
            existingData
          );
          
          if (teamResult && teamResult.equipe_responsavel) {
            const equipeEncontrada = await findTeamByNameDirect(teamResult.equipe_responsavel);
            if (equipeEncontrada) {
              equipe_responsavel_id = equipeEncontrada.id;
              console.log('[create-ticket-direct] ✅ IA definiu equipe:', equipeEncontrada.nome);
            }
          }
        }
        
        // CENÁRIO 3: Tem equipe, falta só prioridade
        else if (!temPrioridade && equipe_responsavel_id) {
          console.log('[create-ticket-direct] 📊 IA vai classificar apenas: PRIORIDADE');
          
          const aiResult = await classifyTicket(body.descricao_problema, equipes);
          
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
