// CÓDIGO PARA N8N - TESTAR OPENAI API KEY
// Cole este código em um nó "Code" no N8N

// 1. DEFINA SUA CHAVE OPENAI AQUI:
const OPENAI_API_KEY = 'sua-chave-openai-aqui';

// 2. FUNÇÃO DE TESTE
async function testOpenAI() {
  console.log('🔑 Testando OpenAI API Key...');
  console.log('Chave existe:', !!OPENAI_API_KEY);
  console.log('Tamanho da chave:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);
  console.log('Primeiros 10 caracteres:', OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) : 'null');
  
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sua-chave-openai-aqui') {
    throw new Error('❌ ERRO: Defina sua chave OpenAI no código!');
  }

  try {
    // TESTE 1: Listar modelos
    console.log('\n📋 Testando listagem de modelos...');
    
    const modelsResponse = await fetch('https://api.openai.com/v1/models', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'User-Agent': 'N8N Test'
      }
    });

    console.log('Status modelos:', modelsResponse.status);
    
    if (modelsResponse.status !== 200) {
      const errorText = await modelsResponse.text();
      throw new Error(`❌ ERRO na listagem de modelos: ${modelsResponse.status} - ${errorText}`);
    }

    const modelsData = await modelsResponse.json();
    console.log('✅ SUCCESS! Modelos encontrados:', modelsData.data.length);
    console.log('Alguns modelos:', modelsData.data.slice(0, 3).map(m => m.id));

    // TESTE 2: Embedding
    console.log('\n🔗 Testando embedding...');
    
    const embeddingResponse = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: 'Este é um teste de embedding no N8N'
      })
    });

    console.log('Status embedding:', embeddingResponse.status);
    
    if (embeddingResponse.status !== 200) {
      const errorText = await embeddingResponse.text();
      throw new Error(`❌ ERRO no embedding: ${embeddingResponse.status} - ${errorText}`);
    }

    const embeddingData = await embeddingResponse.json();
    console.log('✅ Embedding SUCCESS!');
    console.log('Dimensões:', embeddingData.data[0].embedding.length);
    console.log('Primeiros valores:', embeddingData.data[0].embedding.slice(0, 5));

    // TESTE 3: Chat Completion (opcional)
    console.log('\n💬 Testando chat completion...');
    
    const chatResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'user', content: 'Diga "Teste OK" se você recebeu esta mensagem.' }
        ],
        max_tokens: 10
      })
    });

    if (chatResponse.status === 200) {
      const chatData = await chatResponse.json();
      console.log('✅ Chat SUCCESS!');
      console.log('Resposta:', chatData.choices[0].message.content);
    }

    return {
      success: true,
      message: '🎉 CHAVE OPENAI ESTÁ FUNCIONANDO PERFEITAMENTE!',
      tests: {
        models: '✅ OK',
        embedding: '✅ OK',
        chat: chatResponse.status === 200 ? '✅ OK' : '⚠️ Parcial'
      }
    };

  } catch (error) {
    console.error('❌ ERRO:', error.message);
    return {
      success: false,
      error: error.message,
      message: '❌ Chave OpenAI com problema'
    };
  }
}

// EXECUTAR TESTE E RETORNAR RESULTADO
return await testOpenAI();