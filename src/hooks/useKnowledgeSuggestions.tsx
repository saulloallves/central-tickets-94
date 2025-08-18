
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface KnowledgeSuggestion {
  id: string;
  ticket_id?: string;
  texto_sugerido: string;
  modelo_provedor: 'openai' | 'lambda';
  modelo_nome?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface CreateSuggestionData {
  ticket_id?: string;
  texto_sugerido: string;
  modelo_provedor?: 'openai' | 'lambda';
  modelo_nome?: string;
}

export const useKnowledgeSuggestions = () => {
  const [suggestions, setSuggestions] = useState<KnowledgeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchSuggestions = async (status?: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from('knowledge_suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('status', status);
      }

      const { data, error } = await query;

      if (error) throw error;
      setSuggestions(data || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const createSuggestion = async (suggestionData: CreateSuggestionData) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('knowledge_suggestions')
        .insert({
          ...suggestionData,
          sugerido_por: userData.user?.id
        })
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "✨ Sugestão Criada",
        description: "Nova sugestão enviada para avaliação",
      });

      await fetchSuggestions();
      return data;
    } catch (error) {
      console.error('Error creating suggestion:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a sugestão",
        variant: "destructive",
      });
      return null;
    }
  };

  const updateSuggestionStatus = async (id: string, status: string, avaliadoPor?: string) => {
    try {
      const { error } = await supabase
        .from('knowledge_suggestions')
        .update({
          status,
          avaliado_por: avaliadoPor,
          publicado_em: status === 'approved' ? new Date().toISOString() : null
        })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "✅ Status Atualizado",
        description: `Sugestão ${status === 'approved' ? 'aprovada' : 'rejeitada'}`,
      });

      await fetchSuggestions();
    } catch (error) {
      console.error('Error updating suggestion:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  return {
    suggestions,
    loading,
    fetchSuggestions,
    createSuggestion,
    updateSuggestionStatus
  };
};
