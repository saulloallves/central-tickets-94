import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🧪 Testing format response prompt configuration');

    // Buscar configurações atuais do prompt de formatação
    const { data: aiSettings, error: settingsError } = await supabase
      .from('faq_ai_settings')
      .select('prompt_format_response')
      .eq('ativo', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('❌ Error fetching AI settings:', settingsError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch AI settings' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔧 AI Settings found:', {
      hasCustomPrompt: !!aiSettings?.prompt_format_response,
      promptLength: aiSettings?.prompt_format_response?.length || 0,
      promptPreview: aiSettings?.prompt_format_response?.substring(0, 150) + '...'
    });

    // Get a recent ticket to test with
    const { data: tickets, error: ticketsError } = await supabase
      .from('tickets')
      .select('id, codigo_ticket')
      .order('created_at', { ascending: false })
      .limit(1);

    if (ticketsError || !tickets || tickets.length === 0) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'No tickets found for testing' 
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const testTicket = tickets[0];
    console.log(`📋 Testing format response with ticket: ${testTicket.codigo_ticket}`);

    // Test with simple message that needs formatting
    const testMessage = "sim, pode mandar";
    
    console.log('🚀 Calling process-response with test message...');
    
    // Call process-response function directly via Supabase client
    const { data: processResult, error: processError } = await supabase.functions.invoke('process-response', {
      body: {
        ticket_id: testTicket.id,
        usuario_id: '870c6202-d3fc-4b3d-a21a-381eff731740', // Admin user
        mensagem: testMessage
      }
    });

    if (processError) {
      console.error('❌ Error calling process-response:', processError);
      throw processError;
    }
    
    console.log('✅ Process result:', processResult);
    
    return new Response(JSON.stringify({ 
      success: true,
      message: 'Teste de formatação concluído com sucesso',
      configuracoes_ai: {
        prompt_personalizado_ativo: !!aiSettings?.prompt_format_response,
        tamanho_prompt: aiSettings?.prompt_format_response?.length || 0,
        preview_prompt: aiSettings?.prompt_format_response?.substring(0, 200) + '...'
      },
      teste_executado: {
        ticket_usado: testTicket.codigo_ticket,
        mensagem_original: testMessage,
        mensagem_formatada: processResult.resposta_corrigida || 'Erro no processamento',
        foi_processado: !!processResult.resposta_corrigida,
        detalhes_resultado: processResult
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error in test:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});