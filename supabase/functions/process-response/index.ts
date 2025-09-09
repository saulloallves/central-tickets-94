import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const openaiApiKey = Deno.env.get('OPENAI_API_KEY');

async function corrigirResposta(mensagem: string) {
  if (!openaiApiKey) {
    console.log('⚠️ OpenAI API key não configurada, retornando mensagem original');
    return mensagem;
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `Você é um especialista em comunicação de atendimento ao cliente. 
Corrija e padronize a resposta do atendente seguindo estas regras:
1. Corrija português (ortografia, gramática)
2. Use tom educado e profissional
3. Mantenha o conteúdo essencial da resposta
4. Torne a resposta mais clara e completa

Responda apenas com a versão corrigida da mensagem.`
          },
          {
            role: 'user',
            content: `Corrija esta resposta de atendimento: ${mensagem}`
          }
        ],
        max_tokens: 500,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Erro ao corrigir resposta:', error);
    return mensagem; // Retorna original em caso de erro
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Iniciando process-response');
    
    const body = await req.json();
    const { mensagem, ticket_id, usuario_id } = body;
    
    console.log('📝 Dados recebidos:', { 
      ticket_id, 
      usuario_id, 
      mensagem_length: mensagem?.length || 0 
    });

    if (!mensagem || !ticket_id || !usuario_id) {
      console.error('❌ Dados obrigatórios ausentes');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Dados obrigatórios ausentes' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔄 Corrigindo resposta...');
    const respostaCorrigida = await corrigirResposta(mensagem);
    console.log('✅ Resposta corrigida');

    // Por enquanto, não vamos avaliar para documentação
    // Apenas corrigir e retornar
    const avaliacao = {
      pode_documentar: false,
      classificacao: "Não",
      resultado: "Apenas correção de texto ativada"
    };

    console.log('✅ Processamento concluído');

    return new Response(JSON.stringify({
      success: true,
      resposta_corrigida: respostaCorrigida,
      avaliacao_documentacao: avaliacao,
      dados_documentacao: null,
      pode_virar_documento: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Erro no processamento:', error);
    console.error('❌ Stack trace:', error.stack);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});