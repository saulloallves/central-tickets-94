import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export const useCrisisManagement = () => {
  const { toast } = useToast();

  const linkTicketToCrisis = async (ticketId: string, crisisId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();
      
      // Inserir vínculo
      const { error: linkError } = await supabase
        .from('crise_ticket_links')
        .insert({
          crise_id: crisisId,
          ticket_id: ticketId,
          linked_by: userData.user?.id
        });

      if (linkError) throw linkError;

      // Atualizar prioridade do ticket para 'crise'
      const { error: ticketError } = await supabase
        .from('tickets')
        .update({ prioridade: 'crise' })
        .eq('id', ticketId);

      if (ticketError) throw ticketError;

      // Incrementar contador da crise
      const { data: countData } = await supabase
        .from('crise_ticket_links')
        .select('ticket_id', { count: 'exact' })
        .eq('crise_id', crisisId);

      await supabase
        .from('crises')
        .update({ 
          tickets_count: countData?.length || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', crisisId);

      toast({
        title: "✅ Ticket Vinculado",
        description: "Ticket vinculado à crise com sucesso"
      });

      return { success: true };
    } catch (error: any) {
      console.error('Erro ao vincular ticket:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao vincular ticket à crise",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  const unlinkTicketFromCrisis = async (ticketId: string, crisisId: string) => {
    try {
      const { data: userData } = await supabase.auth.getUser();

      // Usar função SQL que já existe
      const { error } = await supabase.rpc('unlink_ticket_from_crisis', {
        p_crise_id: crisisId,
        p_ticket_id: ticketId,
        p_by: userData.user?.id || null
      });

      if (error) throw error;

      // Atualizar contador da crise
      const { data: countData } = await supabase
        .from('crise_ticket_links')
        .select('ticket_id', { count: 'exact' })
        .eq('crise_id', crisisId);

      await supabase
        .from('crises')
        .update({ 
          tickets_count: countData?.length || 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', crisisId);

      toast({
        title: "✅ Ticket Desvinculado",
        description: "Ticket removido da crise com sucesso"
      });

      return { success: true };
    } catch (error: any) {
      console.error('Erro ao desvincular ticket:', error);
      toast({
        title: "Erro",
        description: error.message || "Erro ao desvincular ticket da crise",
        variant: "destructive"
      });
      return { success: false, error };
    }
  };

  const getActiveCrises = async () => {
    try {
      const { data, error } = await supabase
        .from('crises')
        .select('id, titulo, status, tickets_count, created_at')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      console.error('Erro ao buscar crises ativas:', error);
      return { data: null, error };
    }
  };

  const getCrisisForTicket = async (ticketId: string) => {
    try {
      const { data, error } = await supabase
        .from('crise_ticket_links')
        .select(`
          crise_id,
          crises (
            id,
            titulo,
            status,
            is_active
          )
        `)
        .eq('ticket_id', ticketId)
        .maybeSingle();

      if (error) throw error;
      return { data: data?.crises || null, error: null };
    } catch (error: any) {
      console.error('Erro ao buscar crise do ticket:', error);
      return { data: null, error };
    }
  };

  return {
    linkTicketToCrisis,
    unlinkTicketFromCrisis,
    getActiveCrises,
    getCrisisForTicket
  };
};
