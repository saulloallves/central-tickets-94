// Teste da OpenAI API Key
// Execute: node test-openai.js

const https = require('https');

// COLOQUE SUA CHAVE OPENAI AQUI:
const OPENAI_API_KEY = 'sua-chave-aqui';

function testOpenAI() {
  console.log('🔑 Testando OpenAI API Key...');
  console.log('Chave existe:', !!OPENAI_API_KEY);
  console.log('Tamanho da chave:', OPENAI_API_KEY ? OPENAI_API_KEY.length : 0);
  console.log('Primeiros 10 caracteres:', OPENAI_API_KEY ? OPENAI_API_KEY.substring(0, 10) : 'null');
  
  if (!OPENAI_API_KEY || OPENAI_API_KEY === 'sua-chave-aqui') {
    console.error('❌ ERRO: Defina sua chave OpenAI no código!');
    return;
  }

  // Teste 1: Listar modelos
  console.log('\n📋 Testando listagem de modelos...');
  
  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/models',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'User-Agent': 'Node.js Test'
    }
  };

  const req = https.request(options, (res) => {
    console.log('Status:', res.statusCode);
    console.log('Headers:', res.headers);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        const result = JSON.parse(data);
        console.log('✅ SUCCESS! Modelos encontrados:', result.data.length);
        console.log('Alguns modelos:', result.data.slice(0, 3).map(m => m.id));
        
        // Teste 2: Embedding
        testEmbedding();
      } else {
        console.error('❌ ERRO na API:');
        console.error('Status:', res.statusCode);
        console.error('Response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ ERRO de conexão:', error);
  });

  req.end();
}

function testEmbedding() {
  console.log('\n🔗 Testando embedding...');
  
  const postData = JSON.stringify({
    model: 'text-embedding-3-small',
    input: 'Este é um teste de embedding'
  });

  const options = {
    hostname: 'api.openai.com',
    port: 443,
    path: '/v1/embeddings',
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  const req = https.request(options, (res) => {
    console.log('Status embedding:', res.statusCode);
    
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    
    res.on('end', () => {
      if (res.statusCode === 200) {
        const result = JSON.parse(data);
        console.log('✅ Embedding SUCCESS!');
        console.log('Dimensões:', result.data[0].embedding.length);
        console.log('Primeiros valores:', result.data[0].embedding.slice(0, 5));
        console.log('\n🎉 CHAVE OPENAI ESTÁ FUNCIONANDO PERFEITAMENTE!');
      } else {
        console.error('❌ ERRO no embedding:');
        console.error('Status:', res.statusCode);
        console.error('Response:', data);
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ ERRO de conexão no embedding:', error);
  });

  req.write(postData);
  req.end();
}

// Executar teste
testOpenAI();