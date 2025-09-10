import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/components/ui/use-toast';

interface AutoApproval {
  id: string;
  original_message: string;
  corrected_response: string;
  documentation_content: string;
  similar_documents: any[];
  comparative_analysis?: string;
  ticket_id?: string;
  created_by?: string;
  status: string;
  ai_evaluation?: any;
  decision_reason?: string;
  created_at: string;
  updated_at: string;
}

export const useAutoApprovals = () => {
  const [approvals, setApprovals] = useState<AutoApproval[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchApprovals = async (status?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('knowledge_auto_approvals')
        .select('*')
        .order('created_at', { ascending: false });

      if (status && status !== 'all') {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Erro ao buscar aprovações:', error);
        throw error;
      }

      setApprovals((data || []).map(item => ({
        ...item,
        similar_documents: Array.isArray(item.similar_documents) ? item.similar_documents : []
      })));
      
      console.log(`📋 Aprovações carregadas: ${data?.length || 0} registros (status: ${status || 'todos'})`);
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar aprovações",
        variant: "destructive"
      });
      setApprovals([]);
    } finally {
      setLoading(false);
    }
  };

  const updateApprovalStatus = async (id: string, status: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_auto_approvals')
        .update({
          status,
          decision_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) {
        console.error('Erro ao atualizar aprovação:', error);
        throw error;
      }

      // Update local state
      setApprovals(prev => 
        prev.map(approval => 
          approval.id === id 
            ? { ...approval, status, decision_reason: reason, updated_at: new Date().toISOString() }
            : approval
        )
      );

      toast({
        title: "Status atualizado",
        description: `Aprovação ${status === 'approved' ? 'aprovada' : status === 'rejected' ? 'rejeitada' : 'atualizada'}`,
      });

      return true;
    } catch (error) {
      console.error('Erro:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status da aprovação",
        variant: "destructive"
      });
      return false;
    }
  };

  const createDocumentFromApproval = async (approvalId: string, createNew: boolean = true) => {
    try {
      const approval = approvals.find(a => a.id === approvalId);
      if (!approval) {
        toast({
          title: "Erro",
          description: "Aprovação não encontrada",
          variant: "destructive"
        });
        return false;
      }

      // Chamar função para criar documento
      const { data, error } = await supabase.functions.invoke('kb-create-memory', {
        body: {
          estilo: 'Institucional',
          titulo: `Documentação gerada automaticamente - ${new Date().toLocaleDateString()}`,
          categoria: 'Suporte',
          conteudo: approval.documentation_content,
          automatico: true,
          approval_id: approvalId
        }
      });

      if (error) {
        console.error('Erro ao criar documento:', error);
        toast({
          title: "Erro",
          description: "Não foi possível criar o documento",
          variant: "destructive"
        });
        return false;
      }

      // Marcar como aprovado pelo usuário
      await updateApprovalStatus(approvalId, 'user_approved', 'Documento criado pelo usuário');

      toast({
        title: "Documento criado",
        description: "Novo documento adicionado à base de conhecimento",
      });

      return true;
    } catch (error) {
      console.error('Erro:', error);
      return false;
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  return {
    approvals,
    loading,
    fetchApprovals,
    updateApprovalStatus,
    createDocumentFromApproval
  };
};