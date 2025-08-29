
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RAGDocument {
  id: string;
  artigo_id: string;
  titulo: string;
  conteudo: any;
  versao: number;
  parent_id?: string;
  tipo: 'permanente' | 'temporario';
  valido_ate?: string;
  tags: string[];
  status: 'ativo' | 'vencido' | 'em_revisao' | 'arquivado' | 'substituido';
  justificativa: string;
  criado_por: string;
  criado_em: string;
  embedding?: number[];
}

interface DocumentFilters {
  status?: string;
  tipo?: string;
  search?: string;
}

interface SimilarDocument {
  id: string;
  titulo: string;
  conteudo: any;
  versao: number;
  similaridade: number;
}

export const useRAGDocuments = () => {
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDocuments = async (filters?: DocumentFilters) => {
    setLoading(true);
    try {
      // Use Edge Function to get documents
      const { data, error } = await supabase.functions.invoke('get-documentos-list', {
        body: {
          status_filter: filters?.status || null,
          tipo_filter: filters?.tipo || null,
          search_term: filters?.search || null
        }
      });

      if (error) throw error;
      setDocuments((data as RAGDocument[]) || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os documentos",
        variant: "destructive",
      });
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const createDocument = async (documentData: {
    titulo: string;
    conteudo: any;
    tipo?: 'permanente' | 'temporario';
    valido_ate?: string;
    tags?: string[];
    justificativa: string;
    artigo_id?: string;
  }) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('kb-upsert-document', {
        body: documentData
      });

      if (error) {
        if (error.message?.includes('409')) {
          // Duplicate found
          const errorData = typeof error === 'string' ? JSON.parse(error) : error;
          return {
            success: false,
            warning: 'duplicate_found',
            similar_documents: errorData.similar_documents as SimilarDocument[],
            message: errorData.message
          };
        }
        throw error;
      }

      toast({
        title: "✅ Documento Criado",
        description: data.message || "Documento adicionado à base RAG",
      });

      await fetchDocuments();
      return { success: true, document: data.document };
    } catch (error: any) {
      console.error('Error creating document:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar o documento",
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  };

  const updateDocumentStatus = async (id: string, status: string) => {
    try {
      // Use direct query with type assertion since we know the table exists
      const { error } = await (supabase as any)
        .from('documentos')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "✅ Status Atualizado",
        description: `Documento marcado como ${status}`,
      });

      await fetchDocuments();
    } catch (error) {
      console.error('Error updating document status:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  const runAudit = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('kb-audit');

      if (error) throw error;

      toast({
        title: "🔍 Auditoria Concluída",
        description: `${data.inconsistencias.length} inconsistências encontradas`,
      });

      return data;
    } catch (error) {
      console.error('Error running audit:', error);
      toast({
        title: "Erro",
        description: "Não foi possível executar a auditoria",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  // Search documents by similarity
  const searchSimilar = async (query: string, threshold: number = 0.75, limit: number = 5) => {
    try {
      const { data, error } = await supabase.functions.invoke('kb-search', {
        body: { query, threshold, limit }
      });

      if (error) throw error;
      return data.documents as SimilarDocument[];
    } catch (error) {
      console.error('Error searching documents:', error);
      return [];
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return {
    documents,
    loading,
    fetchDocuments,
    createDocument,
    updateDocumentStatus,
    runAudit,
    searchSimilar
  };
};
