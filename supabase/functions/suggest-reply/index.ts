import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { encontrarDocumentosRelacionados, rerankComLLM, gerarRespostaComContexto } from './rag-engine.ts';
import { prepararMensagemParaFranqueado } from './text-utils.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface TicketResponse {
  success: boolean;
  resposta?: string;
  rag_metrics?: {
    documentos_encontrados: number;
    candidatos_encontrados: number;
    pipeline: string;
    selecionados: Array<{ id: string, titulo: string }>;
    fontes_utilizadas?: string[];
  };
  error?: string;
}

async function obterSugestaoDeRespostaParaTicket(ticket: any): Promise<TicketResponse> {
  try {
    console.log('🤖 Iniciando pipeline RAG...');
    
    const textoDoTicket = `Título: ${ticket.titulo}\nDescrição: ${ticket.descricao_problema}`;
    console.log('📝 Dados do ticket:', {
      titulo: ticket.titulo,
      categoria: ticket.categoria,
      descricao_length: ticket.descricao_problema?.length || 0
    });

    // 1) Recuperar candidatos (12)
    console.log('1. Buscando conhecimento relevante na base...');
    const candidatos = await encontrarDocumentosRelacionados(textoDoTicket, 12);
    
    if (candidatos.length === 0) {
      console.log('❌ Nenhum documento encontrado');
      return {
        success: true,
        resposta: "Não encontrei informações relevantes na base de conhecimento para este ticket.",
        rag_metrics: {
          documentos_encontrados: 0,
          candidatos_encontrados: 0,
          pipeline: 'v4_hibrido',
          selecionados: []
        }
      };
    }

    console.log(`2. Encontrados ${candidatos.length} candidatos. Executando rerank...`);

    // 2) Rerank LLM (top-5)
    let docsSelecionados = await rerankComLLM(candidatos, textoDoTicket);
    if (!docsSelecionados.length) {
      console.warn('No docs after rerank; falling back to top-5 candidatos');
      docsSelecionados = candidatos.slice(0, 5);
    }
    
    console.log('Docs selecionados para resposta:',
      docsSelecionados.map(d => `${d.id}:${d.titulo}`).join(' | ')
    );

    if (docsSelecionados.length === 0) {
      return {
        success: true,
        resposta: "Documentos encontrados, mas nenhum foi considerado relevante.",
        rag_metrics: {
          documentos_encontrados: 0,
          candidatos_encontrados: candidatos.length,
          pipeline: 'v4_hibrido',
          selecionados: []
        }
      };
    }

    // 3) Gerar resposta curta com citação
    console.log('3. Gerando resposta com contexto...');
    const respostaRAG = await gerarRespostaComContexto(docsSelecionados, textoDoTicket);
    
    let textoFinal: string;
    let fontesUtilizadas: number[] = [];
    
    try {
      const payload = JSON.parse(respostaRAG);
      textoFinal = prepararMensagemParaFranqueado(payload.texto);
      fontesUtilizadas = payload.fontes || [];
      
      // Converter números das fontes para IDs dos documentos
      const fontesIds = fontesUtilizadas
        .filter(idx => idx >= 1 && idx <= docsSelecionados.length)
        .map(idx => docsSelecionados[idx - 1]?.id)
        .filter(Boolean);
        
      console.log('✅ Resposta RAG gerada e formatada:', textoFinal.substring(0, 100) + '...');
      
    } catch (e) {
      console.error('Error parsing RAG JSON response:', e);
      textoFinal = prepararMensagemParaFranqueado(respostaRAG);
      fontesUtilizadas = [];
    }

    return {
      success: true,
      resposta: textoFinal,
      rag_metrics: {
        documentos_encontrados: docsSelecionados.length,
        candidatos_encontrados: candidatos.length,
        pipeline: 'v4_hibrido',
        selecionados: docsSelecionados.map(d => ({ id: d.id, titulo: d.titulo })),
        fontes_utilizadas: fontesIds || []
      }
    };

  } catch (error) {
    console.error('❌ Erro no pipeline RAG:', error);
    return {
      success: false,
      error: `Erro no pipeline RAG: ${error.message}`,
      rag_metrics: {
        documentos_encontrados: 0,
        candidatos_encontrados: 0,
        pipeline: 'v4_hibrido_error',
        selecionados: []
      }
    };
  }
}

serve(async (req) => {
  console.log('📥 Recebendo requisição...');

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== INICIANDO GERAÇÃO DE SUGESTÃO RAG ===');
    
    // Verificar se a API key do OpenAI está configurada
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('❌ OpenAI API key não configurada');
    }
    console.log('✅ OpenAI API key configurada');

    // Parse request body
    const body = await req.json();
    console.log('📋 Request body parsed:', { ticketId: body.ticketId });
    
    if (!body.ticketId) {
      return new Response(JSON.stringify({ 
        error: 'ticketId é obrigatório',
        success: false 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('🎫 Ticket ID:', body.ticketId);

    // Buscar dados do ticket
    console.log('🔍 Buscando dados do ticket...');
    const { data: ticket, error: ticketError } = await supabase
      .from('tickets')
      .select('id, codigo_ticket, titulo, descricao_problema, categoria, prioridade')
      .eq('id', body.ticketId)
      .single();

    if (ticketError || !ticket) {
      console.error('❌ Erro ao buscar ticket:', ticketError);
      return new Response(JSON.stringify({ 
        error: 'Ticket não encontrado',
        success: false 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('✅ Ticket encontrado:', ticket.codigo_ticket);

    // Executar pipeline RAG
    const resultado = await obterSugestaoDeRespostaParaTicket(ticket);

    if (!resultado.success) {
      console.log('💥 ERRO FATAL na função suggest-reply:', new Error(resultado.error));
      console.log('📤 Enviando resposta de erro');
      return new Response(JSON.stringify({
        error: resultado.error,
        details: `Error: ${resultado.error}`
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Salvar interação no banco
    const { error: saveError } = await supabase
      .from('ticket_ai_interactions')
      .insert({
        ticket_id: body.ticketId,
        kind: 'suggestion',
        resposta: resultado.resposta,
        log: {
          pipeline: resultado.rag_metrics?.pipeline,
          documentos_encontrados: resultado.rag_metrics?.documentos_encontrados,
          candidatos_encontrados: resultado.rag_metrics?.candidatos_encontrados,
          selecionados: resultado.rag_metrics?.selecionados,
          fontes_utilizadas: resultado.rag_metrics?.fontes_utilizadas
        }
      });

    if (saveError) {
      console.error('⚠️ Erro ao salvar interação (não crítico):', saveError);
    }

    console.log('✅ Resposta RAG enviada com sucesso');
    
    return new Response(JSON.stringify({
      resposta: resultado.resposta,
      rag_metrics: resultado.rag_metrics,
      success: true
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 ERRO FATAL na função suggest-reply:', error);
    console.log('Stack trace:', error);
    console.log('📤 Enviando resposta de erro');
    
    return new Response(JSON.stringify({
      error: error.message,
      details: error.stack || error.toString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});