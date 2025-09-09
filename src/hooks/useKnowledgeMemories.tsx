
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateMemoryData {
  estilo: 'manual' | 'diretrizes';
  titulo?: string;
  categoria?: string;
  content: string;
  file?: File;
}

export const useKnowledgeMemories = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const createMemory = async (data: CreateMemoryData) => {
    setLoading(true);
    try {
      let arquivo_path = null;
      let finalContent = data.content;

      // Se há arquivo, fazer upload
      if (data.file) {
        const fileExt = data.file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `memories/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('knowledge')
          .upload(filePath, data.file);

        if (uploadError) {
          throw new Error(`Erro no upload: ${uploadError.message}`);
        }

        arquivo_path = filePath;

        // Se é arquivo de texto, ler conteúdo
        if (data.file.type === 'text/plain' || data.file.name.endsWith('.md') || data.file.name.endsWith('.txt')) {
          const fileText = await data.file.text();
          finalContent = fileText;
        }
      }

      // Chamar edge function para processar
      const { data: result, error } = await supabase.functions.invoke('kb-create-memory', {
        body: {
          estilo: data.estilo,
          titulo: data.titulo,
          categoria: data.categoria,
          content: finalContent,
          arquivo_path
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "✨ Memória Criada",
        description: `Nova memória "${result.titulo}" adicionada à base de conhecimento`,
      });

      return result;

    } catch (error) {
      console.error('Erro ao criar memória:', error);
      toast({
        title: "Erro",
        description: `Não foi possível criar a memória: ${error.message}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const updateDocument = async (documentId: string, newContent: string, updateType: 'full' | 'partial', textToReplace?: string) => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('kb-update-document', {
        body: {
          documentId,
          newContent,
          updateType,
          textToReplace
        }
      });

      if (error) {
        throw new Error(error.message);
      }

      toast({
        title: "✨ Documento Atualizado",
        description: "O documento foi atualizado com sucesso",
      });

      return result;

    } catch (error) {
      console.error('Erro ao atualizar documento:', error);
      toast({
        title: "Erro",
        description: `Não foi possível atualizar o documento: ${error.message}`,
        variant: "destructive",
      });
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return {
    createMemory,
    updateDocument,
    loading
  };
};
