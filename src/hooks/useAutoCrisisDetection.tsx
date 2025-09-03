import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AutoDetectionResult {
  success: boolean;
  message: string;
  tickets_analyzed: number;
  crises_created: Array<{
    crisis_id: string;
    titulo: string;
    tickets_count: number;
  }>;
  analysis_summary?: any;
}

export const useAutoCrisisDetection = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const runAutoDetection = async (): Promise<AutoDetectionResult | null> => {
    setLoading(true);
    try {
      console.log('Iniciando detecção automática de crises...');

      const { data, error } = await supabase.functions.invoke('auto-crisis-detection', {
        body: {}
      });

      if (error) {
        console.error('Error in auto crisis detection:', error);
        toast({
          title: "Erro na Detecção",
          description: "Não foi possível executar a detecção automática",
          variant: "destructive",
        });
        return null;
      }

      console.log('Resultado da detecção:', data);

      if (data.crises_created && data.crises_created.length > 0) {
        toast({
          title: "🚨 Crises Detectadas!",
          description: `${data.crises_created.length} crises foram criadas automaticamente`,
        });
        
        // Disparar evento para atualizar painel de crises
        window.dispatchEvent(new CustomEvent('crisis-detected', {
          detail: { crises: data.crises_created }
        }));
      } else {
        toast({
          title: "✅ Análise Concluída",
          description: data.message || "Nenhuma crise detectada no momento",
        });
      }

      return data;
    } catch (error) {
      console.error('Error in auto crisis detection:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado na detecção automática",
        variant: "destructive",
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const scheduleAutoDetection = () => {
    // Executar a cada 30 minutos
    const interval = setInterval(async () => {
      console.log('Executando detecção automática agendada...');
      await runAutoDetection();
    }, 30 * 60 * 1000); // 30 minutos

    return () => clearInterval(interval);
  };

  return {
    runAutoDetection,
    scheduleAutoDetection,
    loading
  };
};