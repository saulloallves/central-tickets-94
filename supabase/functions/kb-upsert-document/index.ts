
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const DOCUMENT_ORGANIZER_PROMPT = `### 🎯 MISSÃO
Você atua como **Organizador de Documentos Brutos**, preparando conteúdos para uso posterior em:
- IA vetorizada • JSON estruturado • fluxos de chatbot • textos institucionais  

Seu objetivo é **estruturar, limpar e organizar** o material **sem reescrever nem interpretar** o conteúdo — com as exceções explícitas de anonimização e remoção de datas/situações pontuais descritas abaixo.

---

### 1 | TIPOS DE FONTE DE CONTEÚDO  
O texto original pode vir de:  
• Transcrições (vídeo/áudio) • Prints de conversa • Manuais, listas, anotações • Conversas informais ou resumos orais  
**Nenhuma parte pode ser omitida**, a menos que a regra de remoção abaixo se aplique.

---

### 2 | TAREFAS OBRIGATÓRIAS

| Nº | O que fazer | Como fazer |
|----|-------------|------------|
| **2.1** | **Organizar** o material em sequência lógica | Insira **títulos descritivos em negrito** que indiquem o assunto de cada bloco. |
| **2.2** | **Preservar** a linguagem original | Não reformule frases; mantenha gírias, oralidade, repetições, etc. |
| **2.3** | **Destacar** partes relevantes | Use **negrito**, *itálico*, emojis (⚠️ ✅ 💡 📌) e listas quando ajudar a leitura. |
| **2.4** | **Não resumir** | Transcreva tudo integralmente (salvo remoções obrigatórias). |
| **2.5** | **Corrigir divergências internas** | Se o texto repetir a mesma informação de formas distintas, mantenha apenas a versão **mais coerente ou mais frequente**, sem alterar o sentido. |
| **2.6** | **Anonimizar** | Substitua nomes próprios por **[nome removido]** ou apague se irrelevantes. |
| **2.7** | **Remover/Anonimizar DATAS e SITUAÇÕES ÚNICAS** | Siga as regras da seção 3. |
| **2.8** | **Aplicar substituições de termos** | Use a tabela da seção 4. |
| **2.9** | **Entregar conteúdo pronto** | Siga o formato da seção 5. |

---

### 3 | REGRAS DE REMOÇÃO DE DATAS & CONTEXTOS NÃO RECORRENTES  

1. **Remova** qualquer menção explícita de datas absolutas ou relativas:  
   - Formatos como "12/05/2024", "12-05-24", "12 de maio de 2024", "ontem", "na próxima terça-feira", "em dois dias", etc.  
   - Substitua por **[data removida]**.  
2. **Mantenha** a data **apenas** quando fizer parte **integral** do **nome oficial** de um evento, produto ou documento (ex.: "Evento **1º de Abril**").  
3. **Generalize** ou **remova** referências a situações que não se repetirão (ex.: "evento relâmpago da Copa de 2018").  
   - Se a informação for imprescindível ao contexto, troque por **[situação pontual removida]**.  
4. A remoção de datas e situações **tem prioridade** sobre a regra "não omitir nada".

---

### 4 | SUBSTITUIÇÕES OBRIGATÓRIAS DE TERMOS  

| Termo original | Substituir por |
|----------------|----------------|
| promoção / promoções | evento / eventos |
| desconto / descontos | benefício / benefícios |
| oferta / ofertas | oportunidade / oportunidades |
| Envie uma mensagem no grupo do Concierge / Envie mensagem no GiraBot | *(remover a frase exata; manter o restante da sentença)* |

---

### 5 | FORMATO DE ENTREGA DO CONTEÚDO FINAL  

- Blocos organizados com **títulos em negrito**.  
- Trechos importantes destacados (negrito, itálico, emojis, listas).  
- **Nenhuma parte omitida**, exceto datas e situações cobertas pela seção 3.  
- Texto anonimizado e já com substituições da seção 4 aplicadas.  

---

### 6 | FLUXO DE TRABALHO  

1. Aguarde o(s) texto(s) bruto(s).  
2. Siga integralmente as seções 2 – 5.  
3. Entregue o conteúdo reestruturado.  
4. Não execute nenhuma outra ação nem adicione comentários fora do texto final organizado.  

---

💡 **Dica rápida:** se ficar em dúvida se algo é "data" ou "nome de evento", preserve se estiver em maiúsculas ou claramente como nome próprio; caso contrário, remova como data.

**Aguardando conteúdo para iniciar a organização.**`;

const MANUAL_CLASSIFIER_PROMPT = `Você é um **Classificador Documental Sênior** responsável por atribuir códigos de classificação
a documentos da rede de franquias *Cresci e Perdi*, usando o plano de classes abaixo
(baseado em ISO 15489 e NBR 13142).

=======================================================================
PLANO DE CLASSES  (abreviações de três letras)
-----------------------------------------------------------------------
00 Governança & Estratégia ............. GOV
  00.01 Planejamento Estratégico
  00.02 Expansão / Franqueados
  00.03 Políticas Corporativas

01 Operações de Loja ................... OPE
  01.01 Atendimento & Experiência
  01.02 PDV & Caixa
  01.03 Estoque & Inventário
  01.04 Avaliação & Precificação
  01.05 Higienização & Embalagem
  01.06 Layout & Merchandising
  01.07 Segurança & Incidentes

02 Produtos & Categorias ............... PRO
  02.01 Itens Grandes
  02.02 Vestuário
  02.03 Calçados & Acessórios
  02.04 Brinquedos
  02.05 Kits & Mostruários

03 Marketing & Vendas .................. MKT
  03.01 Estratégias de Preço
  03.02 Campanhas & Eventos
  03.03 Comunicação & Redes Sociais
  03.04 Persona & Segmentação

04 Compras & Fornecedores .............. COM
  04.01 Procedência & Qualidade
  04.02 Avaliação / Negociação de Fornecedores
  04.03 Nota Fiscal & Compliance

05 Suporte & Reclamações ............... SUP
  05.01 SAC & Reclame Aqui
  05.02 Concierge / IA de Suporte
  05.03 Pagamentos (PIX / GiraCrédito)

06 Treinamento & Desenvolvimento ....... TRE
  06.01 Programas / Trilhas
  06.02 Transcrições & Vídeos
  06.03 Checklists Operacionais

07 Jurídico & Risco .................... JUR
  07.01 Fraudes / Nota Falsa
  07.02 Concorrência Desleal & Incidentes
  07.03 Políticas Fiscais
=======================================================================

## Entrada esperada
- **title**: título do documento sem aspas
- **description**: resumo ou abstract  
- **content** *(opcional)*: texto integral

## Saída obrigatória  
Retorne **exclusivamente** um objeto JSON (sem comentários) contendo, nesta ordem:

1. **titulo_padrao** – string formada por  
   \`<classe_abrev> <subclasse_codigo> – <title>\`
2. **classe_abrev**
3. **classe_codigo**
4. **classe_nome**
5. **subclasse_codigo**
6. **subclasse_nome**
7. **justificativa** – 1 – 2 frases citando palavras-chave que sustentam a escolha
8. **content_full** – **texto completo** do documento organizado e estruturado.

> **Nada deve ser incluído fora desse objeto JSON.**  
> Não forneça exemplos, nem repita estas instruções.

## Regras de decisão
1. Priorize *content* > *description* > *title* em caso de divergência.
2. Se o documento se encaixar em uma só subclasse, atribua-a; caso transversal, escolha a que
   melhor represente a **função principal**.
3. Dúvida entre duas subclasses da mesma classe → opte pela mais específica.
4. Se nenhuma subclasse couber, retorne \`null\` em **subclasse_codigo** e **subclasse_nome**,
   mas indique a **classe** pertinente.
5. Empregue exatamente a grafia e abreviações listadas.

## Dicas rápidas
- Termos *preço, etiqueta, margem* → 01.04 ou 03.01 (processo interno × estratégia de mercado).
- *Evento, campanha, Black Friday, 15 ou Menos* → 03.02.
- *Treinamento, vídeo, checklist* → 06.x.
- *Fornecedor, procedência, NF-e* → 04.x.
- *PIX, GiraCrédito, SAC* → 05.x.
- *Política corporativa* → 00.03.

Execute estritamente conforme instruções.`;

const DIRETRIZES_PROMPT = `✅ PROMPT FIXO – CLASSIFICADOR INSTITUCIONAL CRESCI E PERDI

Você é um classificador institucional da rede Cresci e Perdi, especializado em analisar conteúdos operacionais (como regras, e avisos de infrações). Sempre que receber um novo conteúdo, execute esta análise padronizada e retorne obrigatoriamente com as seguintes seções:

⸻

🎯 CATEGORIAS OFICIAIS DE CLASSIFICAÇÃO (escolher uma única):
	1.	🔵 Comunicação Visual e Estética de Loja
Estética dos produtos, da loja, bastidores, roupas em más condições, cabides, cenário, fantasias, mídia visual.
	2.	🟠 Conduta Comercial e Padronização da Franquia
Infrações comerciais, regras institucionais, criação de eventos não autorizados, brindes, linguagem proibida, padronização geral.
	3.	🟡 Precificação e Gestão de Produtos
Regras sobre preço, valor de peças, reservas, uso de etiquetas, venda sem valor, sistema Giracrédito, precificação manual.
	4.	🟣 Produção de Conteúdo e Mídias Sociais
Trends, áudios, gravações, envio de mídias, comportamento em redes sociais, comunicação online com clientes.
	5.	🟢 Avaliações e Atendimento ao Fornecedor
Regras de avaliação presencial ou online, limites de peças, atendimento ao fornecedor, tempo da peça na loja, exibição de dinheiro.
	6.	⚪ Regras Institucionais e Operação da Unidade
Abertura ou fechamento sem autorização, uso indevido de sistema, móveis não homologados, uniforme próprio, bio institucional fora do padrão.

⸻

🧠 REGRAS DE EXECUÇÃO:
	•	Classifique sempre com apenas uma categoria oficial (obrigatório).
	•	Retorne somente no formato abaixo, sem explicações adicionais.
	•	O conteúdo pode conter links, listas ou blocos — não altere nada, apenas preserve e classifique.
	•	A resposta deve conter quatro partes fixas:

⸻

🧾 FORMATO DE RESPOSTA:

📌 Título: [resuma o tema central em até 1 linha]

📂 Classificação: [emoji + nome da categoria exata]

🧠 Justificativa: [resuma em uma frase curta e objetiva o motivo da classificação]

📄 Conteúdo recebido:
[cole o conteúdo recebido na íntegra, sem alterações]

⸻

✅ EXEMPLO DE SAÍDA ESPERADA:

📌 Título: Envio de fotos de produtos pelo Instagram

📂 Classificação: 🟣 Produção de Conteúdo e Mídias Sociais

🧠 Justificativa: Trata-se de conduta online proibida relacionada ao envio de imagens pelo direct.

📄 Conteúdo recebido:
[texto original completo]`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const bodyData = await req.json();
    console.log('Dados recebidos:', JSON.stringify(bodyData));
    
    const { titulo, conteudo, categoria, tipo, valido_ate, tags, justificativa, artigo_id, force, estilo, process_with_ai } = bodyData;
    
    if (!titulo || !conteudo) {
      console.error('Campos obrigatórios ausentes:', { titulo: !!titulo, conteudo: !!conteudo, justificativa: !!justificativa });
      return new Response(
        JSON.stringify({ 
          error: 'Título e conteúdo são obrigatórios',
          received: { titulo: !!titulo, conteudo: !!conteudo, justificativa: !!justificativa }
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!openAIApiKey) {
      console.error('OPENAI_API_KEY não configurada');
      return new Response(
        JSON.stringify({ error: 'OpenAI API Key não configurada no servidor' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Processando documento:', titulo, 'estilo:', estilo, 'process_with_ai:', process_with_ai);
    console.log('Dados recebidos completos:', JSON.stringify({ titulo, conteudo: conteudo?.substring(0, 100) + '...', categoria, justificativa: justificativa?.substring(0, 50) + '...' }));

    let finalTitulo = titulo;
    let finalConteudo = conteudo;
    let finalCategoria = categoria || 'geral';
    let classificacaoData = null;
    let iaModelo = null;

    // Se tem estilo e deve processar com IA
    if (estilo && process_with_ai && openAIApiKey) {
      console.log('Processando com IA - estilo:', estilo);

      // Get AI settings
      const { data: aiSettings } = await supabase
        .from('faq_ai_settings')
        .select('*')
        .eq('ativo', true)
        .maybeSingle();

      const modelToUse = aiSettings?.modelo_resumo || 'gpt-4o-mini';
      const apiProvider = aiSettings?.api_provider || 'openai';
      iaModelo = modelToUse;
      
      let apiUrl = 'https://api.openai.com/v1/chat/completions';
      let authToken = openAIApiKey;
      
      if (apiProvider === 'lambda' && aiSettings?.api_base_url) {
        apiUrl = `${aiSettings.api_base_url}/chat/completions`;
        authToken = aiSettings.api_key || openAIApiKey;
      }

      if (estilo === 'manual') {
        // ETAPA 1: Organizar documento
        console.log('Organizando documento...');
        
        const organizerResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [
              { role: 'system', content: DOCUMENT_ORGANIZER_PROMPT },
              { role: 'user', content: conteudo }
            ],
            max_tokens: 2000,
            temperature: 0.3
          }),
        });

        if (!organizerResponse.ok) {
          throw new Error(`Document Organizer API error: ${organizerResponse.status}`);
        }

        const organizerResult = await organizerResponse.json();
        const organizedContent = organizerResult.choices[0].message.content;

        console.log('Conteúdo organizado, classificando...');

        // ETAPA 2: Classificar documento
        const classifierUserMessage = JSON.stringify({
          title: titulo,
          description: '',
          content: organizedContent
        });

        const classifierResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [
              { role: 'system', content: MANUAL_CLASSIFIER_PROMPT + '\n\nIMPORTANTE: No campo content_full, inclua o texto completo organizado recebido. Retorne apenas o JSON sem texto adicional.' },
              { role: 'user', content: classifierUserMessage }
            ],
            response_format: { type: "json_object" },
            max_tokens: 2000,
            temperature: 0.3
          }),
        });

        if (!classifierResponse.ok) {
          throw new Error(`Classifier API error: ${classifierResponse.status}`);
        }

        const classifierResult = await classifierResponse.json();
        const aiResponse = classifierResult.choices[0].message.content;

        try {
          const jsonStart = aiResponse.indexOf('{');
          const jsonEnd = aiResponse.lastIndexOf('}') + 1;
          
          if (jsonStart === -1 || jsonEnd === 0) {
            throw new Error('Nenhum JSON válido encontrado na resposta');
          }
          
          const cleanJson = aiResponse.substring(jsonStart, jsonEnd);
          const jsonResponse = JSON.parse(cleanJson);
          
          finalTitulo = jsonResponse.titulo_padrao || titulo;
          finalConteudo = jsonResponse.content_full || organizedContent || conteudo;
          finalCategoria = jsonResponse.classe_nome || categoria || 'Manual';
          
          classificacaoData = {
            tipo: 'manual',
            classe_abrev: jsonResponse.classe_abrev,
            classe_codigo: jsonResponse.classe_codigo,
            classe_nome: jsonResponse.classe_nome,
            subclasse_codigo: jsonResponse.subclasse_codigo,
            subclasse_nome: jsonResponse.subclasse_nome,
            justificativa: jsonResponse.justificativa,
            conteudo_original: conteudo,
            conteudo_organizado: organizedContent,
            processado_em: new Date().toISOString()
          };
        } catch (e) {
          console.error('Erro ao parsear JSON, usando fallback:', e);
          finalConteudo = organizedContent || conteudo;
          classificacaoData = { 
            tipo: 'manual', 
            processado_em: new Date().toISOString(),
            erro_classificacao: e.message,
            conteudo_original: conteudo,
            conteudo_organizado: organizedContent
          };
        }

      } else if (estilo === 'diretriz') {
        // Processar diretrizes com uma única IA
        console.log('Processando diretrizes...');
        
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: modelToUse,
            messages: [
              { role: 'system', content: DIRETRIZES_PROMPT },
              { role: 'user', content: conteudo }
            ],
            max_tokens: 2000,
            temperature: 0.3
          }),
        });

        if (!response.ok) {
          throw new Error(`Diretrizes API error: ${response.status}`);
        }

        const result = await response.json();
        const aiResponse = result.choices[0].message.content;

        // Extrair título e categoria da resposta da IA
        const titleMatch = aiResponse.match(/📌 Título:\s*(.+)/);
        const categoryMatch = aiResponse.match(/📂 Classificação:\s*🟢\s*(.+)|📂 Classificação:\s*🔵\s*(.+)|📂 Classificação:\s*🟠\s*(.+)|📂 Classificação:\s*🟡\s*(.+)|📂 Classificação:\s*🟣\s*(.+)|📂 Classificação:\s*⚪\s*(.+)/);
        
        finalTitulo = titleMatch ? titleMatch[1].trim() : titulo;
        finalCategoria = categoryMatch ? (categoryMatch[1] || categoryMatch[2] || categoryMatch[3] || categoryMatch[4] || categoryMatch[5] || categoryMatch[6] || '').trim() : 'Diretrizes Institucionais';
        finalConteudo = aiResponse; // Para diretrizes: resultado da IA
        
        classificacaoData = { 
          tipo: 'diretrizes', 
          conteudo_original: conteudo,
          resultado_diretrizes: aiResponse,
          processado_em: new Date().toISOString() 
        };
      }
    }

    // Preparar texto para embedding
    const textoParaEmbedding = `Título: ${finalTitulo}\nConteúdo: ${typeof finalConteudo === 'string' ? finalConteudo : JSON.stringify(finalConteudo)}`;

    // Gerar embedding usando text-embedding-3-small
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: textoParaEmbedding,
      }),
    });

    if (!embeddingResponse.ok) {
      const error = await embeddingResponse.text();
      throw new Error(`Erro na OpenAI Embeddings: ${error}`);
    }

    const embeddingData = await embeddingResponse.json();
    const embedding = embeddingData.data[0].embedding;

    console.log('Embedding gerado, dimensões:', embedding.length);

    // Verificar duplicatas usando busca vetorial (apenas se não forçado)
    if (!artigo_id && !force) {
      const { data: similares } = await supabase.rpc('match_documentos', {
        query_embedding: embedding,
        match_threshold: 0.85,
        match_count: 3
      });

      if (similares && similares.length > 0) {
        console.log('Documentos similares encontrados:', similares.length);
        return new Response(
          JSON.stringify({ 
            warning: 'duplicate_found',
            similar_documents: similares,
            message: 'Encontramos documentos similares. Deseja criar uma nova versão ou prosseguir?'
          }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
    }

    // Inserir/Atualizar documento
    const documentData = {
      titulo: finalTitulo,
      conteudo: typeof finalConteudo === 'string' ? { texto: finalConteudo } : finalConteudo,
      categoria: finalCategoria,
      tipo: tipo || 'permanente',
      valido_ate,
      tags: tags || [],
      justificativa,
      criado_por: (await supabase.auth.getUser()).data.user?.id,
      embedding,
      artigo_id: artigo_id || crypto.randomUUID(),
      estilo: estilo || null,
      classificacao: classificacaoData,
      processado_por_ia: !!(estilo && process_with_ai),
      ia_modelo: iaModelo
    };

    if (artigo_id) {
      // Nova versão de artigo existente
      const { data: ultimaVersao } = await supabase
        .from('documentos')
        .select('versao')
        .eq('artigo_id', artigo_id)
        .order('versao', { ascending: false })
        .limit(1)
        .single();

      documentData.versao = (ultimaVersao?.versao || 0) + 1;
    }

    const { data, error } = await supabase
      .from('documentos')
      .insert(documentData)
      .select()
      .single();

    if (error) {
      console.error('Erro ao inserir documento:', error);
      throw error;
    }

    console.log('Documento criado com sucesso:', data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        document: data,
        message: artigo_id ? 'Nova versão criada com sucesso' : 'Documento criado com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função kb-upsert-document:', error);
    console.error('Stack trace:', error.stack);
    console.error('Erro detalhado:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: error.stack,
        type: error.name
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
