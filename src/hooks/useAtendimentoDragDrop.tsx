import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useAtendimentoDragDrop = () => {
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const { toast } = useToast();

  const updateAtendimentoStatus = async (atendimentoId: string, newStatus: string) => {
    console.log('🎯 Atendimento drag-drop update:', { atendimentoId, newStatus });
    
    if (isUpdating === atendimentoId) {
      console.log('⚠️ Update already in progress for this atendimento');
      return false;
    }

    // Validate status
    const validStatuses = ['em_fila', 'em_atendimento', 'finalizado'];
    if (!validStatuses.includes(newStatus)) {
      console.error('❌ Invalid status:', newStatus);
      return false;
    }

    setIsUpdating(atendimentoId);

    try {
      // Direct update to Supabase
      const { data, error } = await supabase
        .from('chamados')
        .update({ 
          status: newStatus,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', atendimentoId)
        .select()
        .single();

      if (error) {
        console.error('❌ Supabase update error:', error);
        throw error;
      }

      console.log('✅ Atendimento updated successfully:', data);
      
      toast({
        title: "✅ Status Atualizado",
        description: `Atendimento movido para ${newStatus}`,
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to update atendimento:', error);
      
      toast({
        title: "❌ Erro ao Atualizar",
        description: "Não foi possível atualizar o status do atendimento",
        variant: "destructive",
      });

      return false;
    } finally {
      setIsUpdating(null);
    }
  };

  return {
    updateAtendimentoStatus,
    isUpdating
  };
};