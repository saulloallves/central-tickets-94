
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAIAlertSystem } from '@/hooks/useAIAlertSystem';

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
  const { wrapAIFunction } = useAIAlertSystem();
  const isMountedRef = useRef(true);

  const getLatestSuggestion = async () => {
    if (!ticketId || !isMountedRef.current) return;

    try {
      const { data, error } = await supabase
        .from('ticket_ai_interactions')
        .select('id, resposta, foi_usada, resposta_final, created_at, log')
        .eq('ticket_id', ticketId)
        .eq('kind', 'suggestion')
        .order('created_at', { ascending: false })
        .limit(1);

      if (error) throw error;

      if (isMountedRef.current) {
        if (data && data.length > 0) {
          setSuggestion(data[0] as AISuggestion);
        } else {
          setSuggestion(null);
        }
      }
    } catch (error) {
      console.error('Error fetching suggestion:', error);
    }
  };

  const generateSuggestion = async () => {
    if (!ticketId || !isMountedRef.current) return;
    
    if (isMountedRef.current) setLoading(true);
    console.log('🤖 Iniciando geração de sugestão para ticket:', ticketId);
    
    try {
      // Usar o wrapper de alerta para monitorar a função de IA
      const data = await wrapAIFunction(
        'SuggestReply-RAG',
        'hooks/useAISuggestion/generateSuggestion',
        async () => {
          console.log('📡 Chamando Edge Function suggest-reply...');
          
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
            console.error('❌ Erro na Edge Function:', error);
            throw error;
          }

          console.log('✅ Resposta da Edge Function recebida:', data);

          if (!data || !data.resposta) {
            throw new Error('Resposta vazia da IA');
          }
          
          return data;
        },
        ticketId,
        undefined,
        { ticketId }
      );

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
      
      // Show enhanced RAG metrics in toast - but check if suggestion was actually useful
      const ragMetrics = data.rag_metrics || {};
      const currentSuggestionData = await new Promise<AISuggestion | null>((resolve) => {
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

      // Check if the AI actually found useful information
      const isUsefulResponse = currentSuggestionData?.resposta && 
        !currentSuggestionData.resposta.toLowerCase().includes('não encontrei informações suficientes') &&
        !currentSuggestionData.resposta.toLowerCase().includes('não há informações relevantes');

      if (isUsefulResponse) {
        const fontesCount = ragMetrics.fontes_utilizadas?.length || ragMetrics.selecionados?.length || 0;
        toast({
          title: "✨ Sugestão RAG Gerada",
          description: `${ragMetrics.documentos_encontrados || 0} documentos encontrados | ${fontesCount} fontes utilizadas`,
        });
      } else {
        toast({
          title: "❌ RAG Sem Resultado",
          description: ragMetrics.documentos_encontrados > 0 
            ? `${ragMetrics.documentos_encontrados} documentos encontrados, mas sem relevância suficiente`
            : "Nenhum documento relevante encontrado na base de conhecimento",
          variant: "destructive",
        });
      }

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
      if (isMountedRef.current) setLoading(false);
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
    
    return () => {
      isMountedRef.current = false;
    };
  }, [ticketId]);

  return {
    suggestion,
    loading,
    generateSuggestion,
    markSuggestionUsed,
    refreshSuggestion: getLatestSuggestion
  };
};
