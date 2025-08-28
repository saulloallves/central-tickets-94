import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useCreateTicket = () => {
  const createTicket = useCallback(async (ticketData: any) => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .insert([ticketData])
        .select()
        .single();

      if (error) throw error;
      
      return { data, error: null };
    } catch (error) {
      console.error('❌ Erro ao criar ticket:', error);
      return { data: null, error };
    }
  }, []);

  return { createTicket };
};