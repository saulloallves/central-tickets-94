import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const useReopenTicket = () => {
  const { toast } = useToast();

  const reopenTicket = async (ticketId: string) => {
    try {
      // 1. Buscar ticket atual
      const { data: ticket, error: fetchError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (fetchError) throw fetchError;

      // 2. Calcular nova data limite SLA (4h padrão)
      const now = new Date();
      const slaMinutos = 240; // 4h padrão
      const dataLimiteSLA = new Date(now.getTime() + slaMinutos * 60000);

      // 3. Atualizar ticket
      const { error: updateError } = await supabase
        .from('tickets')
        .update({
          status: 'aberto',
          status_sla: 'dentro_prazo',
          data_limite_sla: dataLimiteSLA.toISOString(),
          sla_minutos_restantes: slaMinutos,
          sla_pausado: false,
          sla_pausado_mensagem: false,
          reaberto_count: (ticket.reaberto_count || 0) + 1,
          resolvido_em: null,
          updated_at: now.toISOString()
        })
        .eq('id', ticketId);

      if (updateError) throw updateError;

      // 4. Inserir mensagem de sistema
      await supabase
        .from('ticket_mensagens')
        .insert([{
          ticket_id: ticketId,
          mensagem: `🔄 Ticket reaberto pelo sistema.\nNovo SLA: ${slaMinutos} minutos (${(slaMinutos/60).toFixed(1)}h)\nPrazo: ${format(dataLimiteSLA, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`,
          direcao: 'saida',
          canal: 'web'
        }]);

      toast({
        title: "✅ Ticket Reaberto",
        description: `SLA reiniciado: ${(slaMinutos/60).toFixed(1)}h`
      });

      return { success: true };
    } catch (error: any) {
      console.error('Erro ao reabrir ticket:', error);
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