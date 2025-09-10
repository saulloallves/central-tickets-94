
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAIAlertSystem } from '@/hooks/useAIAlertSystem';

export const useAIAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { wrapAIFunction } = useAIAlertSystem();

  const analyzeTicket = async (ticketId: string, descricao: string, categoria?: string) => {
    setLoading(true);
    try {
      console.log('Starting AI analysis for ticket:', ticketId);
      
      const { data, error } = await supabase.functions.invoke('analyze-ticket', {
        body: {
          ticketId,
          descricao,
          categoria
        }
      });

      if (error) {
        console.error('AI analysis error:', error);
        toast({
          title: "Erro na Análise IA",
          description: "Não foi possível analisar o ticket automaticamente",
          variant: "destructive",
        });
        return null;
      }

      console.log('AI analysis completed:', data);
      
      if (data.analysis?.is_crise) {
        toast({
          title: "🚨 CRISE DETECTADA",
          description: `Motivo: ${data.analysis.motivo_crise}`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ Análise IA Concluída",
          description: `Prioridade: ${data.analysis?.prioridade} | SLA: ${data.analysis?.sla_sugerido_horas}h`,
        });
      }

      return data;
    } catch (error) {
      console.error('Error in AI analysis:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado na análise IA",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const markAsCrisis = async (ticketId: string, motivo: string) => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      
      // Escalate ticket to crisis priority - the trigger will handle crisis creation
      const { data, error } = await supabase
        .from('tickets')
        .update({ 
          prioridade: 'crise',
          escalonamento_nivel: 5 
        })
        .eq('id', ticketId);

      if (error) {
        console.error('Error activating crisis:', error);
        throw error;
      }

      toast({
        title: "🚨 CRISE ATIVADA",
        description: "Protocolo de emergência iniciado. Notificações enviadas.",
        variant: "destructive",
      });

      return true;
    } catch (error) {
      console.error('Error marking as crisis:', error);
      toast({
        title: "Erro",
        description: "Não foi possível ativar a crise",
        variant: "destructive",
      });
      return false;
    } finally {
      setLoading(false);
    }
  };

  return {
    analyzeTicket,
    markAsCrisis,
    loading
  };
};
