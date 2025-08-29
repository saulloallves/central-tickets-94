
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

export const useRAGDocuments = () => {
  const [documents, setDocuments] = useState<RAGDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDocuments = async (filters?: DocumentFilters) => {
    setLoading(true);
    try {
      let query = supabase
        .from('documentos')
        .select('*')
        .order('criado_em', { ascending: false });

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.tipo) {
        query = query.eq('tipo', filters.tipo);
      }
      if (filters?.search) {
        query = query.ilike('titulo', `%${filters.search}%`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setDocuments(data || []);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os documentos",
        variant: "destructive",
      });
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
            similar_documents: errorData.similar_documents,
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
    } catch (error) {
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
      const { error } = await supabase
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

  useEffect(() => {
    fetchDocuments();
  }, []);

  return {
    documents,
    loading,
    fetchDocuments,
    createDocument,
    updateDocumentStatus,
    runAudit
  };
};
