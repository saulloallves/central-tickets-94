import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface BulkAnalysisResult {
  action: string;
  equipe_id: string;
  total_tickets_analyzed: number;
  groups_found: number;
  groups_with_sufficient_tickets: number;
  results: Array<{
    group: string;
    tickets_count: number;
    crise_created: boolean;
    crise_id?: string;
    suggested_title?: string;
    reasoning?: string;
    ticket_ids: string[];
  }>;
  auto_create_crises: boolean;
}

export const useBulkTicketAnalysis = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<BulkAnalysisResult | null>(null);

  const analyzeTeamTickets = async (
    equipeId: string, 
    autoCreateCrises: boolean = false,
    minTicketsPerGroup: number = 3
  ) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analyze-team-tickets-bulk', {
        body: {
          equipe_id: equipeId,
          auto_create_crises: autoCreateCrises,
          min_tickets_per_group: minTicketsPerGroup
        }
      });

      if (error) {
        throw error;
      }

      setResults(data);
      
      if (data.action === 'insufficient_tickets') {
        toast.info(`Tickets insuficientes para análise. Encontrados: ${data.tickets_found}, mínimo: ${data.min_required}`);
      } else if (data.action === 'insufficient_unlinked_tickets') {
        toast.info(`Tickets não vinculados insuficientes. Encontrados: ${data.unlinked_tickets}, mínimo: ${data.min_required}`);
      } else if (data.action === 'bulk_analysis_completed') {
        const { groups_with_sufficient_tickets, total_tickets_analyzed, auto_create_crises } = data;
        
        if (auto_create_crises && groups_with_sufficient_tickets > 0) {
          toast.success(`Análise concluída! ${groups_with_sufficient_tickets} crises criadas automaticamente de ${total_tickets_analyzed} tickets analisados.`);
        } else if (groups_with_sufficient_tickets > 0) {
          toast.success(`Análise concluída! ${groups_with_sufficient_tickets} grupos de problemas similares identificados em ${total_tickets_analyzed} tickets.`);
        } else {
          toast.info(`Análise concluída. ${total_tickets_analyzed} tickets analisados, nenhum grupo com tickets suficientes encontrado.`);
        }
      }

      return data;
    } catch (error) {
      console.error('Erro na análise em massa:', error);
      toast.error('Erro ao analisar tickets da equipe');
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResults(null);
  };

  return {
    analyzeTeamTickets,
    isLoading,
    results,
    clearResults
  };
};