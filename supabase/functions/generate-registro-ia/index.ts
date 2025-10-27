import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      codigo_grupo, 
      nome_completo, 
      setor, 
      acompanhamento, 
      descricao, 
      acoes, 
      status, 
      prazo, 
      responsavel_local, 
      upload 
    } = await req.json();

    console.log('Gerando registro para unidade:', codigo_grupo);

    // Inicializar Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar informações da unidade
    const { data: unidade, error: unidadeError } = await supabase
      .from('unidades')
      .select('fantasy_name, grupo, codigo_grupo')
      .eq('codigo_grupo', codigo_grupo)
      .single();

    if (unidadeError || !unidade) {
      console.error('Erro ao buscar unidade:', unidadeError);
      return new Response(
        JSON.stringify({ error: 'Unidade não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Determinar nome da unidade (fallback: grupo se fantasy_name estiver vazio)
    const nomeUnidade = unidade.fantasy_name || unidade.grupo || 'Unidade Desconhecida';

    // Formatar data em PT-BR
    const formatDate = (date: Date): string => {
      const months = [
        'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
        'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
      ];
      const day = date.getDate();
      const month = months[date.getMonth()];
      const year = date.getFullYear();
      return `${day} de ${month} de ${year}`;
    };

    const dataFormatada = formatDate(new Date());

    // Construir prompt para IA
    const promptSystem = `Você é o responsável por redigir **registros institucionais de acompanhamento operacional** da Rede Cresci e Perdi.
Seu papel é transformar qualquer relato ou briefing fornecido em um **documento completo, formal e técnico**, mantendo o tom profissional e o formato padrão.

MODELO FIXO DE SAÍDA:

### 📋 REGISTRO DE ACOMPANHAMENTO OPERACIONAL

**Unidade:** [use o nome da unidade e código fornecidos]
**Data:** [use a data fornecida]
**Responsável pela observação:** [use o nome completo fornecido]
**Setor:** [use o setor fornecido]

---

#### **Contexto**
Descreva de forma clara o que foi observado, incluindo a origem da informação, o histórico do problema ou comportamento, e o impacto operacional.
👉 Evite julgamentos; descreva fatos observados e frequência (ex: "terceira semana consecutiva com baixo aproveitamento").

---

#### **Orientações Reforçadas**
Liste de 3 a 5 ações, medidas ou comportamentos que já foram reforçados com o franqueado ou equipe.
Exemplo:
1. Reforçar treinamento da equipe com foco em aproveitamento de lotes.
2. Reduzir recusas por excesso de rigor técnico.
3. Retomar o equilíbrio entre qualidade e volume comercial.

---

#### **Status Atual**
Use marcadores objetivos:
- 🔸 [Resumo do status atual]
- 🔸 [Evolução desde última observação ou ausência dela]
- 🔸 [Próximo passo definido]

---

#### **Ação Recomendável**
Defina o que deve acontecer a seguir e qual setor será responsável.
Exemplo:
> Manter acompanhamento nas próximas 2 semanas. Caso não haja evolução, encaminhar para plano de ação corretiva com suporte direto da franqueadora (Consultoria de Campo).

---

REGRAS DE FORMATAÇÃO:
- Sempre manter o mesmo título e seções, mesmo que alguma esteja vazia.
- Adotar linguagem neutra, técnica e observacional.
- Não usar gírias, ironias ou expressões vagas.
- Sempre indicar frequência e impacto (ex: "duas semanas seguidas", "impacto direto na performance de compra").
- Finalize com recomendação clara e prática.

IMPORTANTE - USO DOS DADOS FORNECIDOS:
- Use EXATAMENTE os dados fornecidos pelo usuário (nome da unidade, data, responsável, setor)
- NÃO deixe placeholders como "null", "[inserir...]" ou campos vazios
- Os dados completos estão no contexto fornecido pelo usuário - você DEVE usá-los diretamente
- O nome da unidade virá no formato "NOME DA UNIDADE (CÓDIGO)" - use exatamente assim

Sempre gere o registro completo conforme o modelo acima, **sem pedir confirmação**, **sem perguntas** e **sem omitir campos**.
O texto deve parecer pronto para ser arquivado ou enviado à diretoria.
Se o relato for muito curto, expanda de forma coerente para manter o nível institucional.`;

    const promptUser = `O QUE VOCÊ VAI RECEBER:

data atual: ${dataFormatada}

UNIDADE: ${nomeUnidade} (${codigo_grupo})
PESSOA QUE ESTÁ ABRINDO O REGISTRO:
NOME: ${nome_completo}
SETOR: ${setor}

ACOMPANHAMENTO: ${acompanhamento}

DESCRIÇÃO: ${descricao}

AÇÕES A SEREM TOMADAS: ${acoes}

STATUS: ${status}

DATA DE PRAZO: ${prazo}

RESPONSÁVEL LOCAL: ${responsavel_local}

${upload ? `URL UPLOAD: ${upload}` : ''}

GERAR UMA SAÍDA COM ESSES DADOS QUE VAI RECEBER`;

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    console.log('Chamando Lovable AI...');

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: promptSystem },
          { role: 'user', content: promptUser }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('Erro na API Lovable AI:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de requisições excedido. Tente novamente mais tarde.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos insuficientes. Adicione fundos ao Lovable AI.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error('Erro ao gerar registro com IA');
    }

    const aiData = await aiResponse.json();
    const registroGerado = aiData.choices?.[0]?.message?.content;

    if (!registroGerado) {
      throw new Error('IA não retornou conteúdo');
    }

    console.log('Registro gerado com sucesso');

    return new Response(
      JSON.stringify({ registro: registroGerado }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Erro em generate-registro-ia:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});