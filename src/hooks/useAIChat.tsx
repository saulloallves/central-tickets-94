import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIChatMessage {
  id: string;
  mensagem: string;
  resposta: string;
  created_at: string;
  user_id?: string;
  log?: {
    rag_hits?: number;
    kb_hits?: number;
    [key: string]: any;
  };
}

export const useAIChat = (ticketId: string) => {
  const [chatHistory, setChatHistory] = useState<AIChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchChatHistory = async () => {
    if (!ticketId) return;

    try {
      const { data, error } = await supabase
        .from('ticket_ai_interactions')
        .select('id, mensagem, resposta, created_at, user_id, log')
        .eq('ticket_id', ticketId)
        .eq('kind', 'chat')
        .order('created_at', { ascending: true });

      if (error) throw error;

      setChatHistory(data as AIChatMessage[] || []);
    } catch (error) {
      console.error('Error fetching chat history:', error);
    }
  };

  const askAI = async (mensagem: string) => {
    if (!mensagem.trim()) return null;

    setLoading(true);
    try {
      console.log('Asking AI:', mensagem);
      
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke('ticket-ai-chat', {
        body: { 
          ticketId, 
          mensagem,
          userId: userData.user?.id
        }
      });

      if (error) {
        console.error('AI chat error:', error);
        toast({
          title: "Erro no Chat IA",
          description: "Não foi possível processar sua pergunta",
          variant: "destructive",
        });
        return null;
      }

      console.log('AI chat response:', data);
      
      // Refresh chat history after new message
      await fetchChatHistory();
      
      return data;
    } catch (error) {
      console.error('Error in AI chat:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado no chat com IA",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChatHistory();
  }, [ticketId]);

  return {
    chatHistory,
    loading,
    askAI,
    refreshHistory: fetchChatHistory
  };
};