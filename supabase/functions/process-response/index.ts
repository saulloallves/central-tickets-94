import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { encontrarDocumentosRelacionados, rerankComLLM } from '../typebot-webhook/rag-engine.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

async function openAI(path: string, payload: any, tries = 3) {
  let wait = 300;
  for (let i = 0; i < tries; i++) {
    const r = await fetch(`https://api.openai.com/v1/${path}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${openaiApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (r.ok) return r;
    if (r.status === 429 || r.status === 503) { 
      await new Promise(res => setTimeout(res, wait)); 
      wait *= 2; 
      continue; 
    }
    throw new Error(`${path} error: ${await r.text()}`);
  }
  throw new Error(`${path} error: too many retries`);
}

async function corrigirResposta(mensagem: string, contextoDocs: any[]) {
  const contexto = contextoDocs.map(doc => `ID: ${doc.id}\nTÍTULO: ${doc.titulo}\nCONTEÚDO: ${doc.conteudo.slice(0, 800)}`).join('\n\n---\n\n');
  
  const systemPrompt = `Você é um especialista em comunicação de atendimento ao cliente e suporte a franqueados. 
Sua função é *corrigir, padronizar e validar todas as respostas de suporte escritas por humanos*, seguindo estas regras:

🧭 Regras de Correção e Padronização:
1. Corrija o texto para *português correto*, sem erros de ortografia, gramática ou concordância.  
2. Use tom de *atendimento solícito, educado e detalhado*, transmitindo paciência e clareza.  
3. Todas as respostas devem parecer vindas da *mesma equipe* → estilo uniforme e institucional.  
4. Sempre que possível, explique de forma *completa e prática*, evitando respostas curtas ou vagas.  
5. Use frases acolhedoras, mas sem exagero, mantendo *profissionalismo e cordialidade*.  
6. Nunca altere o *conteúdo essencial* da resposta, apenas melhore forma, clareza e tom.

🔎 Regras de Confronto com o Banco de Conhecimento:
- Sempre confronte a resposta humana com a informação do *banco de conhecimento oficial*.
- Se houver divergência entre a resposta humana e o banco:
  - *Priorize a resposta do banco*.  
  - A resposta corrigida *não pode contrariar o banco*.
- Se o tema *não existir no banco*, apenas faça a correção e padronização, sem inventar ou supor informações.

📌 Saída esperada:
Gere a *versão corrigida e padronizada da resposta*, já validada com o banco de conhecimento.`;

  const userPrompt = `BANCO DE CONHECIMENTO:\n${contexto}\n\nRESPOSTA HUMANA PARA CORRIGIR:\n${mensagem}\n\nCorrija e padronize esta resposta:`;

  const response = await openAI('chat/completions', {
    model: 'gpt-5-2025-08-07',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ],
    max_completion_tokens: 1000
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

async function avaliarParaDocumentacao(respostaCorrigida: string) {
  const systemPrompt = `Você é um agente moderador e especialista em documentação institucional.  
Sua função é analisar qualquer texto recebido e decidir se ele pode ser transformado em uma documentação/regra oficial.

🧭 REGRAS DE AVALIAÇÃO
1. O texto só pode ser aceito como documentação se:
   - Estiver completo (não faltar informações críticas).
   - Não contiver dúvidas, subjetividade ou continuação de conversa.
   - Estiver claro, objetivo e com teor institucional.
2. Se o texto *não cumprir* esses requisitos, classifique como *"Não permitido transformar em documentação"* e explique quais informações faltam ou por que ele gera dúvidas.
3. Se o texto *cumprir* os requisitos, então:
   - Corrija a ortografia e gramática.
   - Remova expressões informais ou de conversa.
   - Formate no padrão de *documentação institucional oficial*.

📌 Saída SEMPRE deve ter duas partes:
- *Classificação:* Pode ser transformado em documentação? (Sim ou Não).
- *Resultado:*  
  - Se "Não": explique os pontos que faltam.  
  - Se "Sim": entregue o texto final no formato de documentação institucional.

RESPONDA EM JSON:
{
  "pode_documentar": true/false,
  "classificacao": "Sim" ou "Não",
  "resultado": "texto final ou explicação dos pontos que faltam"
}`;

  const response = await openAI('chat/completions', {
    model: 'gpt-5-2025-08-07',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: respostaCorrigida }
    ],
    max_completion_tokens: 1000,
    response_format: { type: 'json_object' }
  });

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function processarParaDocumentacao(conteudo: string) {
  console.log('🔍 Processando para documentação:', conteudo.substring(0, 100));
  
  // Buscar documentos similares
  const documentosSimilares = await encontrarDocumentosRelacionados(conteudo, 8);
  const documentosReranked = await rerankComLLM(documentosSimilares, conteudo);
  
  console.log(`📚 Encontrados ${documentosReranked.length} documentos similares`);
  
  // Gerar análise comparativa
  const analiseComparativa = await gerarAnaliseComparativa(conteudo, documentosReranked);
  
  return {
    documentos_similares: documentosReranked,
    analise_comparativa: analiseComparativa
  };
}

async function gerarAnaliseComparativa(novoConteudo: string, documentosExistentes: any[]) {
  const contextoExistente = documentosExistentes.map(doc => 
    `**${doc.titulo}**\n${doc.conteudo.slice(0, 600)}`
  ).join('\n\n---\n\n');

  const prompt = `Você é um especialista em análise de conteúdo e detecção de duplicatas/conflitos em bases de conhecimento.

Analise o NOVO CONTEÚDO comparado aos DOCUMENTOS EXISTENTES e forneça uma análise detalhada.

## NOVO CONTEÚDO:
${novoConteudo}

## DOCUMENTOS EXISTENTES:
${contextoExistente}

## INSTRUÇÕES:
1. **Identifique sobreposições** entre o novo conteúdo e os existentes
2. **Detecte contradições** - informações conflitantes que podem confundir usuários
3. **Avalie se deve:** Criar novo documento, atualizar existente, ou rejeitar por duplicata
4. **Forneça recomendação** clara com justificativa

## FORMATO DE RESPOSTA:
### 📋 Novo Documento
**Assunto:** [extrair o assunto principal]
**Tipo:** [classificar como: Procedimento, Regra, FAQ, Política, etc.]

### 🔍 Sobreposição com Existentes
[Listar documentos com conteúdo similar e percentual de sobreposição]

### ⚖️ Análise Comparativa
[Comparar informações e identificar diferenças]

### ⚠️ Contradições Encontradas
[Listar qualquer informação conflitante - CRÍTICO para decisão]

### 💡 Recomendação
**Ação:** [CRIAR NOVO / ATUALIZAR EXISTENTE / REJEITAR]
**Justificativa:** [Explicar o motivo da recomendação]`;

  const response = await openAI('chat/completions', {
    model: 'gpt-5-2025-08-07',
    messages: [{ role: 'user', content: prompt }],
    max_completion_tokens: 1500
  });

  const data = await response.json();
  return data.choices[0].message.content;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mensagem, ticket_id, usuario_id } = await req.json();
    
    console.log('🔄 Processando resposta:', { ticket_id, usuario_id, mensagem: mensagem.substring(0, 100) });

    // 1. Buscar documentos relacionados para correção
    const documentosRelacionados = await encontrarDocumentosRelacionados(mensagem, 5);
    const documentosRanqueados = await rerankComLLM(documentosRelacionados, mensagem);
    
    console.log(`📚 Encontrados ${documentosRanqueados.length} documentos para correção`);

    // 2. Corrigir e padronizar resposta
    const respostaCorrigida = await corrigirResposta(mensagem, documentosRanqueados);
    console.log('✅ Resposta corrigida');

    // 3. Avaliar se pode ser documentação
    const avaliacao = await avaliarParaDocumentacao(respostaCorrigida);
    console.log('📝 Avaliação para documentação:', avaliacao.classificacao);

    let dadosDocumentacao = null;
    if (avaliacao.pode_documentar) {
      // 4. Processar para documentação (busca semântica)
      dadosDocumentacao = await processarParaDocumentacao(avaliacao.resultado);
      
      // 5. Salvar na tabela de aprovações automáticas
      const { data: aprovacao, error } = await supabase
        .from('knowledge_auto_approvals')
        .insert({
          original_message: mensagem,
          corrected_response: respostaCorrigida,
          documentation_content: avaliacao.resultado,
          similar_documents: dadosDocumentacao.documentos_similares,
          comparative_analysis: dadosDocumentacao.analise_comparativa,
          ticket_id,
          created_by: usuario_id,
          status: 'pending',
          ai_evaluation: avaliacao
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Erro ao salvar aprovação:', error);
      } else {
        console.log('💾 Aprovação salva:', aprovacao.id);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      resposta_corrigida: respostaCorrigida,
      avaliacao_documentacao: avaliacao,
      dados_documentacao: dadosDocumentacao,
      pode_virar_documento: avaliacao.pode_documentar
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});