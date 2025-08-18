
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AIFeedbackData {
  ticket_id: string;
  interaction_id?: string;
  util: boolean;
  motivo?: string;
}

export const useAIFeedback = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const submitFeedback = async (feedbackData: AIFeedbackData) => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('ai_feedback')
        .insert({
          ...feedbackData,
          created_by: userData.user?.id
        });

      if (error) throw error;

      toast({
        title: "✅ Feedback Registrado",
        description: "Obrigado por avaliar a resposta da IA",
      });

      return true;
    } catch (error) {
      console.error('Error submitting AI feedback:', error);
      toast({
        title: "Erro",
        description: "Não foi possível registrar o feedback",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  const getFeedbackForTicket = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('ai_feedback')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error fetching feedback:', error);
      return [];
    }
  };

  return {
    submitFeedback,
    getFeedbackForTicket,
    loading
  };
};
