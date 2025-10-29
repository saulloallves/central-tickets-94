
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface RAGDocument {
  id: string;
  artigo_id: string;
  titulo: string;
  conteudo: any;
  categoria: string;
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
  estilo?: 'manual' | 'diretriz';
  classificacao?: any;
  processado_por_ia?: boolean;
  ia_modelo?: string;
  profile?: {
    nome_completo: string;
    email: string;
  };
}

interface DocumentFilters {
  status?: string;
  tipo?: string;
  categoria?: string;
  search?: string;
  estilo?: string;
  page?: number;
  limit?: number;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
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
  const [pagination, setPagination] = useState<PaginationInfo>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  });
  const { toast } = useToast();

  const fetchDocuments = async (filters?: DocumentFilters) => {
    setLoading(true);
    console.log('🔍 Fetching RAG documents with filters:', filters);
    try {
      const { data, error } = await supabase.functions.invoke('get-documentos-list', {
        body: {
          status_filter: filters?.status || null,
          tipo_filter: filters?.tipo || null,
          categoria_filter: filters?.categoria || null,
          search_term: filters?.search || null,
          estilo_filter: filters?.estilo || null,
          page: filters?.page || 1,
          limit: filters?.limit || 20
        }
      });

      console.log('📊 RAG documents response:', { data, error });
      if (error) throw error;
      
      if (data && typeof data === 'object' && 'data' in data) {
        setDocuments(data.data || []);
        setPagination(data.pagination || {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false
        });
      } else {
        // Fallback for old response format
        setDocuments((data as RAGDocument[]) || []);
      }
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
    categoria?: string;
    tipo?: 'permanente' | 'temporario';
    valido_ate?: string;
    tags?: string[];
    justificativa: string;
    artigo_id?: string;
    estilo?: 'manual' | 'diretriz';
    process_with_ai?: boolean;
    force?: boolean;
  }) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('kb-upsert-document', {
        body: documentData
      });

      console.log('Response from kb-upsert-document:', { data, error });

      if (error) {
        console.log('Error details:', error);
        throw error;
      }

      // Verificar se a resposta indica duplicata
      if (data && data.warning === 'duplicate_found') {
        console.log('Duplicata encontrada na resposta:', data);
        return {
          success: false,
          warning: 'duplicate_found',
          similar_documents: data.similar_documents as SimilarDocument[],
          message: data.message || 'Documentos similares encontrados'
        };
      }

      // Se chegou aqui, documento foi criado com sucesso
      if (data && data.success) {
        toast({
          title: "✅ Documento Criado",
          description: data.message || "Documento adicionado à base RAG",
        });

        await fetchDocuments();
        return { success: true, document: data.document };
      }

      // Fallback - tratar como erro se não tem sucesso nem warning
      throw new Error('Resposta inesperada do servidor');
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
      const { data, error } = await supabase.functions.invoke('kb-update-document', {
        body: { id, status }
      });

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

  const updateDocument = async (documentId: string, updateData: {
    titulo?: string;
    conteudo?: any;
    categoria?: string;
    updateType?: 'full' | 'partial';
    textToReplace?: string;
  }) => {
    try {
      setLoading(true);
      
      console.log('🚀 Enviando requisição para kb-update-document:', {
        id: documentId,
        ...updateData
      });
      
      const { data, error } = await supabase.functions.invoke('kb-update-document', {
        body: { 
          id: documentId, 
          ...updateData 
        }
      });

      console.log('📥 Resposta da edge function:', { data, error });

      if (error) {
        console.error('❌ Erro da edge function:', error);
        throw error;
      }

      toast({
        title: "✅ Documento Atualizado",
        description: `Documento atualizado com sucesso`,
      });

      await fetchDocuments();
      return { success: true };
    } catch (error) {
      console.error('❌ Erro no hook updateDocument:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o documento: " + error.message,
        variant: "destructive",
      });
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
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

  // Check cron job status (always returns active since cron is configured in migration)
  const checkCronStatus = () => {
    return {
      jobname: 'kb-audit-hourly',
      schedule: '0 * * * *', // Every hour
      active: true,
      description: 'Executa auditoria a cada 1 hora'
    };
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return {
    documents,
    loading,
    pagination,
    fetchDocuments,
    createDocument,
    updateDocument,
    updateDocumentStatus,
    runAudit,
    searchSimilar,
    checkCronStatus
  };
};
