import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      id, 
      status, 
      titulo, 
      conteudo, 
      categoria, 
      updateType, 
      textToReplace 
    } = await req.json();
    
    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Atualizando documento:', id, 'com dados:', { 
      status, titulo, categoria, updateType, textToReplace 
    });

    let updateData: any = {};
    
    // Se está apenas atualizando status
    if (status && !titulo && !conteudo) {
      updateData.status = status;
    } 
    // Se está atualizando conteúdo
    else if (titulo || conteudo || categoria) {
      if (titulo) updateData.titulo = titulo;
      if (categoria) updateData.categoria = categoria;
      
      if (conteudo) {
        if (updateType === 'partial' && textToReplace) {
          // Buscar o documento atual para fazer substituição parcial
          const { data: currentDoc, error: fetchError } = await supabase
            .from('documentos')
            .select('conteudo')
            .eq('id', id)
            .single();
            
          if (fetchError) {
            console.error('Erro ao buscar documento atual:', fetchError);
            throw fetchError;
          }
          
          // Fazer substituição do texto
          let currentContent = '';
          if (typeof currentDoc.conteudo === 'string') {
            currentContent = currentDoc.conteudo;
          } else if (typeof currentDoc.conteudo === 'object') {
            currentContent = JSON.stringify(currentDoc.conteudo);
          }
          
          let newContent = currentContent.replace(textToReplace, conteudo);
          updateData.conteudo = newContent;
          
          console.log('Substituição parcial:', {
            textoOriginal: textToReplace,
            textoNovo: conteudo,
            resultado: newContent.substring(0, 200) + '...'
          });
        } else {
          // Atualização completa
          updateData.conteudo = conteudo;
        }
      }
      
      // Incrementar versão quando há mudança de conteúdo
      if (conteudo) {
        const { data: currentDoc } = await supabase
          .from('documentos')
          .select('versao')
          .eq('id', id)
          .single();
          
        updateData.versao = (currentDoc?.versao || 1) + 1;
        
        // CRÍTICO: Apagar embedding quando conteúdo muda para forçar regeneração
        updateData.embedding = null;
        console.log('🔄 Embedding apagado - será regenerado com novo conteúdo na versão:', updateData.versao);
      }
    }

    console.log('📋 Dados finais que serão enviados para o Supabase:', updateData);

    const { data, error } = await supabase
      .from('documentos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    console.log('📤 Resposta do Supabase:', { data, error });

    if (error) {
      console.error('❌ Erro ao atualizar documento:', error);
      console.error('❌ Update data que causou erro:', updateData);
      throw error;
    }

    console.log('Documento atualizado com sucesso:', data.id);

    // Se foi atualizado conteúdo e foi processado por IA, reprocessar para regenerar embedding
    if (conteudo && data.processado_por_ia && data.estilo) {
      console.log('🔄 Reprocessando documento com IA para regenerar embedding...');
      
      try {
        // Chamar a função de upsert para reprocessar e regenerar embedding
        const { data: reprocessData, error: reprocessError } = await supabase.functions.invoke('kb-upsert-document', {
          body: {
            titulo: data.titulo,
            conteudo: typeof data.conteudo === 'string' ? data.conteudo : JSON.stringify(data.conteudo),
            categoria: data.categoria,
            estilo: data.estilo,
            process_with_ai: true,
            update_existing_id: data.id // Flag para indicar que é uma atualização
          }
        });

        if (reprocessError) {
          console.error('❌ Erro ao reprocessar documento:', reprocessError);
        } else {
          console.log('✅ Documento reprocessado com sucesso - embedding regenerado');
        }
      } catch (reprocessErr) {
        console.error('❌ Erro ao chamar reprocessamento:', reprocessErr);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        document: data,
        message: updateType === 'partial' && textToReplace 
          ? `Texto "${textToReplace}" substituído com sucesso`
          : `Documento atualizado com sucesso`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro na função kb-update-document:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});