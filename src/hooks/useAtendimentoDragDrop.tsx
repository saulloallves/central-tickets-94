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
      
      // Se o status mudou para 'em_atendimento', adicionar ao grupo WhatsApp
      if (newStatus === 'em_atendimento') {
        try {
          console.log('🔗 Adicionando ao grupo WhatsApp...');
          
          const { data: groupResult, error: groupError } = await supabase.functions.invoke('add-to-whatsapp-group', {
            body: { chamadoId: atendimentoId }
          });

          if (groupError) {
            console.error('❌ Erro ao adicionar ao grupo:', groupError);
            toast({
              title: "⚠️ Status Atualizado com Aviso",
              description: `Atendimento movido para ${newStatus}, mas houve erro ao adicionar ao grupo WhatsApp`,
              variant: "destructive",
            });
          } else if (groupResult?.success) {
            console.log('✅ Adicionado ao grupo com sucesso:', groupResult);
            toast({
              title: "✅ Status Atualizado",
              description: `Atendimento movido para ${newStatus} e ${groupResult.participant} adicionado ao grupo`,
            });
          } else {
            console.error('❌ Falha ao adicionar ao grupo:', groupResult);
            toast({
              title: "⚠️ Status Atualizado com Aviso", 
              description: `Atendimento movido para ${newStatus}, mas falha ao adicionar ao grupo WhatsApp`,
              variant: "destructive",
            });
          }
        } catch (error) {
          console.error('❌ Erro inesperado ao adicionar ao grupo:', error);
          toast({
            title: "⚠️ Status Atualizado com Aviso",
            description: `Atendimento movido para ${newStatus}, mas erro inesperado ao adicionar ao grupo`,
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "✅ Status Atualizado",
          description: `Atendimento movido para ${newStatus}`,
        });
      }

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