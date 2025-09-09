import { supabase } from '@/integrations/supabase/client';

export const regenerateAllEmbeddings = async () => {
  console.log('🔄 Iniciando regeneração de todos os embeddings...');
  
  try {
    const { data, error } = await supabase.functions.invoke('regenerate-all-embeddings', {
      body: {}
    });

    if (error) {
      throw error;
    }

    console.log('✅ Regeneração concluída:', data);
    return data;
    
  } catch (error) {
    console.error('❌ Erro na regeneração:', error);
    throw error;
  }
};

// Auto-executar ao importar este arquivo
console.log('🚀 EXECUTANDO REGENERAÇÃO AUTOMÁTICA DE EMBEDDINGS...');
setTimeout(() => {
  regenerateAllEmbeddings()
    .then(result => {
      console.log('🎯 ✅ SUCESSO - EMBEDDINGS REGENERADOS:', result);
      alert(`✅ Embeddings atualizados! ${result.sucessos} documentos processados com sucesso.`);
    })
    .catch(error => {
      console.error('🚨 ❌ ERRO NA REGENERAÇÃO:', error);
      alert(`❌ Erro na regeneração: ${error.message}`);
    });
}, 2000);