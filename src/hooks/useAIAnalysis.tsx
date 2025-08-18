
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useAIAnalysis = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

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
    try {
      // Atualizar ticket como crise
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          prioridade: 'crise',
          status: 'escalonado',
          escalonamento_nivel: 5
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // Disparar notificações de crise
      await supabase.functions.invoke('process-notifications', {
        body: {
          ticketId,
          type: 'crise_detectada',
          priority: 'immediate'
        }
      });

      toast({
        title: "🚨 MARCADO COMO CRISE",
        description: "Notificações enviadas para toda a hierarquia",
        variant: "destructive",
      });

      return true;
    } catch (error) {
      console.error('Error marking as crisis:', error);
      toast({
        title: "Erro",
        description: "Não foi possível marcar como crise",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    analyzeTicket,
    markAsCrisis,
    loading
  };
};
