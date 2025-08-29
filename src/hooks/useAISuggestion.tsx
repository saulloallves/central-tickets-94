
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AISuggestion {
  id: string;
  resposta: string;
  foi_usada: boolean;
  resposta_final?: string;
  created_at: string;
  log?: {
    rag_pipeline?: string;
    embedding_model?: string;
    documentos_encontrados?: number;
    relevancia_media?: number;
    fontes_citadas?: Array<{
      id: string;
      titulo: string;
      versao: number;
      relevancia: number;
    }>;
    [key: string]: any;
  };
}

export const useAISuggestion = (ticketId: string) => {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const getLatestSuggestion = async () => {
    if (!ticketId) return;

    try {
      const { data, error } = await supabase
        .from('ticket_ai_interactions')
        .select('id, resposta, foi_usada, resposta_final, created_at, log')
        .eq('ticket_id', ticketId)
        .eq('kind', 'suggestion')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (data && data.length > 0) {
        setSuggestion(data[0] as AISuggestion);
      } else {
        setSuggestion(null);
      }
    } catch (error) {
      console.error('Error fetching suggestion:', error);
    }
  };

  const generateSuggestion = async () => {
    setLoading(true);
    try {
      console.log('Generating RAG-powered AI suggestion for ticket:', ticketId);
      
      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout: A requisição RAG demorou mais que 45 segundos')), 45000)
      );
      
      // Race between function call and timeout
      const suggestionPromise = supabase.functions.invoke('suggest-reply', {
        body: { ticketId }
      });
      
      const { data, error } = await Promise.race([suggestionPromise, timeoutPromise]) as any;

      if (error) {
        console.error('RAG Suggestion error:', error);
        toast({
          title: "Erro na Sugestão RAG",
          description: error.message || "Não foi possível gerar sugestão com a base RAG",
          variant: "destructive",
        });
        return null;
      }

      console.log('RAG AI suggestion generated:', data);
      
      // Polling to wait for suggestion to appear in database
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1500)); // Wait 1.5s
        await getLatestSuggestion();
        
        // Check if suggestion was loaded
        const currentSuggestion = await new Promise<AISuggestion | null>((resolve) => {
          const checkSuggestion = async () => {
            try {
              const { data: checkData } = await supabase
                .from('ticket_ai_interactions')
                .select('id, resposta, foi_usada, resposta_final, created_at, log')
                .eq('ticket_id', ticketId)
                .eq('kind', 'suggestion')
                .order('created_at', { ascending: false })
                .limit(1);
              
              resolve(checkData && checkData.length > 0 ? checkData[0] as AISuggestion : null);
            } catch {
              resolve(null);
            }
          };
          checkSuggestion();
        });
        
        if (currentSuggestion && currentSuggestion.created_at > new Date(Date.now() - 90000).toISOString()) {
          // Found recent suggestion, break polling
          break;
        }
        
        attempts++;
      }
      
      // Show enhanced RAG metrics in toast
      const ragMetrics = data.rag_metrics || {};
      toast({
        title: "✨ Sugestão RAG Gerada",
        description: `${ragMetrics.documentos_encontrados || 0} documentos RAG | Relevância: ${ragMetrics.relevancia_media || '0%'}`,
      });

      return data;
    } catch (error) {
      console.error('Error generating RAG suggestion:', error);
      const isTimeout = error instanceof Error && error.message.includes('Timeout');
      toast({
        title: isTimeout ? "Tempo Esgotado RAG" : "Erro",
        description: isTimeout 
          ? "A busca RAG está demorando. A base pode estar indexando. Tente novamente."
          : "Erro inesperado ao gerar sugestão RAG",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const markSuggestionUsed = async (suggestionId: string, finalText: string) => {
    try {
      const { error } = await supabase
        .from('ticket_ai_interactions')
        .update({
          foi_usada: true,
          resposta_final: finalText,
          used_by: (await supabase.auth.getUser()).data.user?.id,
          used_at: new Date().toISOString()
        })
        .eq('id', suggestionId);

      if (error) throw error;

      // Refresh suggestion to show updated status
      await getLatestSuggestion();
      
      toast({
        title: "✅ Sugestão RAG Utilizada",
        description: "Uso da sugestão RAG registrado para análise",
      });

    } catch (error) {
      console.error('Error marking RAG suggestion as used:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar uso da sugestão RAG",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    getLatestSuggestion();
  }, [ticketId]);

  return {
    suggestion,
    loading,
    generateSuggestion,
    markSuggestionUsed,
    refreshSuggestion: getLatestSuggestion
  };
};
