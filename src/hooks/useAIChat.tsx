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

    // Add user message to chat immediately for better UX
    const userMessage: AIChatMessage = {
      id: `temp-${Date.now()}`,
      mensagem: mensagem.trim(),
      resposta: '',
      created_at: new Date().toISOString(),
      user_id: undefined
    };
    
    setChatHistory(prev => [...prev, userMessage]);
    setLoading(true);
    
    try {
      console.log('Asking AI:', mensagem);
      
      const { data: userData } = await supabase.auth.getUser();
      
      const { data, error } = await supabase.functions.invoke('ticket-ai-chat', {
        body: { 
          ticketId, 
          mensagem: mensagem.trim(),
          userId: userData.user?.id
        }
      });

      if (error) {
        console.error('AI chat error:', error);
        // Remove the temporary message on error
        setChatHistory(prev => prev.filter(msg => msg.id !== userMessage.id));
        toast({
          title: "Erro no Chat IA",
          description: "Não foi possível processar sua pergunta",
          variant: "destructive",
        });
        return null;
      }

      console.log('AI chat response:', data);
      
      // Remove temporary message and refresh with real data
      setChatHistory(prev => prev.filter(msg => msg.id !== userMessage.id));
      await fetchChatHistory();
      
      return data;
    } catch (error) {
      console.error('Error in AI chat:', error);
      // Remove the temporary message on error
      setChatHistory(prev => prev.filter(msg => msg.id !== userMessage.id));
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