
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
8. **content_full** – **texto completo** do documento recebido (campo *content*).  
   Se *content* não for fornecido, use \`null\`.

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

Outras regras - 
- nao use palavras como promocao e seu derivados 

Execute estritamente conforme instruções.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { estilo, titulo, categoria, content, arquivo_path } = await req.json();

    console.log('Processando nova memória:', { estilo, titulo, categoria, arquivo_path });

    if (!estilo || !content) {
      return new Response(
        JSON.stringify({ error: 'Estilo e conteúdo são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let aiResponse = '';
    let organizedContent = content;

    if (estilo === 'manual') {
      // ETAPA 1: Organizar documento com o Document Organizer
      console.log('ETAPA 1: Organizando documento...');
      console.log('Document Organizer prompt length:', DOCUMENT_ORGANIZER_PROMPT.length);
      console.log('Content length:', content.length);

      const organizerResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: DOCUMENT_ORGANIZER_PROMPT },
            { role: 'user', content: content }
          ],
          max_tokens: 2000,
          temperature: 0.3
        }),
      });

      console.log('Document Organizer response status:', organizerResponse.status);

      if (!organizerResponse.ok) {
        const errorText = await organizerResponse.text();
        console.error('Document Organizer API error details:', errorText);
        throw new Error(`Document Organizer API error: ${organizerResponse.status} - ${errorText}`);
      }

      const organizerResult = await organizerResponse.json();
      organizedContent = organizerResult.choices[0].message.content;

      console.log('Conteúdo organizado (length):', organizedContent?.length || 0);
      console.log('Conteúdo organizado (first 200 chars):', organizedContent?.substring(0, 200) || 'EMPTY');

      // ETAPA 2: Classificar documento organizado
      console.log('ETAPA 2: Classificando documento...');
      const classifierUserMessage = JSON.stringify({
        title: titulo || 'Documento sem título',
        description: '',
        content: organizedContent
      });

      console.log('Classifier prompt length:', MANUAL_CLASSIFIER_PROMPT.length);
      console.log('Classifier user message length:', classifierUserMessage.length);

      const classifierResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: MANUAL_CLASSIFIER_PROMPT + '\n\nIMPORTANTE: Defina content_full como null para evitar truncamento. Retorne apenas o JSON sem texto adicional.' },
            { role: 'user', content: classifierUserMessage }
          ],
          response_format: { type: "json_object" },
          max_tokens: 2000,
          temperature: 0.3
        }),
      });

      console.log('Classifier response status:', classifierResponse.status);

      if (!classifierResponse.ok) {
        const errorText = await classifierResponse.text();
        console.error('Classifier API error details:', errorText);
        throw new Error(`Classifier API error: ${classifierResponse.status} - ${errorText}`);
      }

      const classifierResult = await classifierResponse.json();
      aiResponse = classifierResult.choices[0].message.content;

      console.log('Resposta do classificador (length):', aiResponse?.length || 0);
      console.log('Resposta do classificador (first 200 chars):', aiResponse?.substring(0, 200) || 'EMPTY');

    } else {
      // DIRETRIZES: Processar com uma única IA
      console.log('Processando diretrizes com uma única IA...');
      console.log('Diretrizes prompt length:', DIRETRIZES_PROMPT.length);
      console.log('Content length:', content.length);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAIApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: DIRETRIZES_PROMPT },
            { role: 'user', content: content }
          ],
          max_tokens: 2000,
          temperature: 0.3
        }),
      });

      console.log('Diretrizes response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Diretrizes API error details:', errorText);
        throw new Error(`Diretrizes API error: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      aiResponse = result.choices[0].message.content;

      console.log('Resposta diretrizes (length):', aiResponse?.length || 0);
      console.log('Resposta diretrizes (first 200 chars):', aiResponse?.substring(0, 200) || 'EMPTY');
    }

    // Processar resposta baseada no estilo
    let processedData: any = {};
    
    if (estilo === 'diretrizes') {
      // Para diretrizes, extrair título e categoria da resposta da IA
      const titleMatch = aiResponse.match(/📌 Título:\s*(.+)/);
      const categoryMatch = aiResponse.match(/📂 Classificação:\s*🟢\s*(.+)|📂 Classificação:\s*🔵\s*(.+)|📂 Classificação:\s*🟠\s*(.+)|📂 Classificação:\s*🟡\s*(.+)|📂 Classificação:\s*🟣\s*(.+)|📂 Classificação:\s*⚪\s*(.+)/);
      
      const extractedTitle = titleMatch ? titleMatch[1].trim() : (titulo || 'Diretriz sem título');
      const extractedCategory = categoryMatch ? (categoryMatch[1] || categoryMatch[2] || categoryMatch[3] || categoryMatch[4] || categoryMatch[5] || categoryMatch[6] || '').trim() : (categoria || 'Diretrizes Institucionais');
      
      processedData = {
        conteudo_formatado: aiResponse,
        titulo: extractedTitle,
        categoria: extractedCategory,
        subcategoria: 'Regras e Normas',
        classificacao: { tipo: 'diretrizes', processado_em: new Date().toISOString() }
      };
    } else {
      // Para manual, extrair do JSON do classificador
      try {
        console.log('Tentando parsear JSON do classificador...');
        console.log('Resposta do classificador (completa):', aiResponse);
        
        // Limpar possível texto extra antes/depois do JSON
        const jsonStart = aiResponse.indexOf('{');
        const jsonEnd = aiResponse.lastIndexOf('}') + 1;
        
        if (jsonStart === -1 || jsonEnd === 0) {
          throw new Error('Nenhum JSON válido encontrado na resposta');
        }
        
        const cleanJson = aiResponse.substring(jsonStart, jsonEnd);
        console.log('JSON extraído:', cleanJson);
        
        const jsonResponse = JSON.parse(cleanJson);
        
        console.log('JSON parseado com sucesso:', {
          titulo_padrao: jsonResponse.titulo_padrao,
          classe_nome: jsonResponse.classe_nome
        });
        
        // Priorizar content_full do classificador se disponível
        const finalContent = jsonResponse.content_full || organizedContent || content;
        
        console.log('Escolhendo conteúdo final:', {
          tem_content_full: !!jsonResponse.content_full,
          content_full_length: jsonResponse.content_full?.length || 0,
          tem_organized: !!organizedContent,
          organized_length: organizedContent?.length || 0,
          escolhido: jsonResponse.content_full ? 'content_full' : organizedContent ? 'organized' : 'original'
        });
        
        processedData = {
          conteudo_formatado: finalContent,
          titulo: jsonResponse.titulo_padrao || titulo || 'Manual sem título',
          categoria: jsonResponse.classe_nome || categoria || 'Manual',
          subcategoria: jsonResponse.subclasse_nome || null,
          classificacao: {
            tipo: 'manual',
            classe_abrev: jsonResponse.classe_abrev,
            classe_codigo: jsonResponse.classe_codigo,
            classe_nome: jsonResponse.classe_nome,
            subclasse_codigo: jsonResponse.subclasse_codigo,
            subclasse_nome: jsonResponse.subclasse_nome,
            justificativa: jsonResponse.justificativa,
            conteudo_original: content,
            conteudo_organizado: organizedContent,
            processado_em: new Date().toISOString()
          }
        };
      } catch (e) {
        console.error('Erro ao parsear JSON do manual, usando fallback regex:', e);
        console.log('Tentando extrair título e categoria com regex...');
        
        // Fallback inteligente: extrair título e categoria usando regex
        const tituloMatch = aiResponse.match(/"titulo_padrao":\s*"([^"]+)"/);
        const categoriaMatch = aiResponse.match(/"classe_nome":\s*"([^"]+)"/);
        
        const extractedTitulo = tituloMatch ? tituloMatch[1] : (titulo || 'Manual sem título');
        const extractedCategoria = categoriaMatch ? categoriaMatch[1] : (categoria || 'Manual');
        
        console.log('Valores extraídos por regex:', {
          titulo: extractedTitulo,
          categoria: extractedCategoria
        });
        
        processedData = {
          conteudo_formatado: organizedContent || content,
          titulo: extractedTitulo,
          categoria: extractedCategoria,
          subcategoria: null,
          classificacao: { 
            tipo: 'manual', 
            processado_em: new Date().toISOString(),
            resposta_bruta: aiResponse,
            metodo_extracao: 'regex_fallback'
          }
        };
      }
    }

    // Salvar na base de conhecimento
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data, error } = await supabase
      .from('knowledge_articles')
      .insert({
        titulo: processedData.titulo,
        conteudo: processedData.conteudo_formatado,
        categoria: processedData.categoria,
        subcategoria: processedData.subcategoria,
        estilo: estilo,
        classificacao: processedData.classificacao,
        arquivo_path: arquivo_path || null,
        tipo_midia: 'texto',
        aprovado: false,
        usado_pela_ia: false,
        ativo: true
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar na base:', error);
      throw new Error(`Erro ao salvar: ${error.message}`);
    }

    console.log('Memória criada com sucesso:', data.id);

    return new Response(
      JSON.stringify({ 
        success: true, 
        memoria_id: data.id,
        titulo: data.titulo,  // Usar o título que foi salvo no banco
        categoria: data.categoria,  // Usar a categoria que foi salva no banco
        subcategoria: data.subcategoria
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função kb-create-memory:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
