import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useSimpleTicketDragDrop = () => {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    console.log('🎯 Simple drag-drop update:', { ticketId, newStatus });
    
    if (isUpdating === ticketId) {
      console.log('⚠️ Update already in progress for this ticket');
      return false;
    }

    // Validate status
    const validStatuses = ['aberto', 'em_atendimento', 'escalonado', 'concluido'];
    if (!validStatuses.includes(newStatus)) {
      console.error('❌ Invalid status:', newStatus);
      return false;
    }

    setIsUpdating(ticketId);

    try {
      // Direct update to Supabase
      const { data, error } = await supabase
        .from('tickets')
        .update({ 
          status: newStatus as 'aberto' | 'em_atendimento' | 'escalonado' | 'concluido',
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase update error:', error);
        throw error;
      }

      console.log('✅ Ticket updated successfully:', data);
      
      toast({
        title: "✅ Status Atualizado",
        description: `Ticket movido para ${newStatus}`,
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to update ticket:', error);
      
      toast({
        title: "❌ Erro ao Atualizar",
        description: "Não foi possível atualizar o status do ticket",
        variant: "destructive",
      });

      return false;
    } finally {
      setIsUpdating(null);
    }
  };

  return {
    updateTicketStatus,
    isUpdating
  };
};