import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const useReopenTicket = () => {
  const { toast } = useToast();

  const reopenTicket = async (ticketId: string, senhaWeb?: string) => {
    try {
      const slaMinutos = 240; // 4h padrão

      // Se senha_web foi fornecida, usar Edge Function (mobile)
      if (senhaWeb) {
        console.log('🔄 Reabrindo via Edge Function (mobile)');
        
        const { data, error } = await supabase.functions.invoke(
          'mobile-reabrir-ticket',
          {
            body: {
              ticketId: ticketId,
              senha_web: senhaWeb,
              sla_minutos: slaMinutos
            }
          }
        );

        if (error) throw error;
        if (!data?.ok) throw new Error(data?.error || 'Erro ao reabrir ticket');

        toast({
          title: "✅ Ticket Reaberto",
          description: `SLA reiniciado: ${(slaMinutos/60).toFixed(1)}h`
        });

        return { success: true };
      }

      // Caso contrário, usar função SQL (admin autenticado)
      console.log('🔄 Reabrindo via SQL Function (admin)');
      
      const { data, error: rpcError } = await supabase
        .rpc('reabrir_ticket', {
          p_ticket_id: ticketId,
          p_sla_minutos: slaMinutos
        });

      if (rpcError) throw rpcError;
      
      const result = data as { success: boolean; error?: string };
      
      if (!result?.success) {
        throw new Error(result?.error || 'Erro ao reabrir ticket');
      }

      toast({
        title: "✅ Ticket Reaberto",
        description: `SLA reiniciado: ${(slaMinutos/60).toFixed(1)}h`
      });

      return { success: true };
    } catch (error: any) {
      console.error('❌ Erro ao reabrir ticket:', error);
      toast({
        title: "Erro ao reabrir ticket",
        description: error.message || "Tente novamente",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  return { reopenTicket };
};