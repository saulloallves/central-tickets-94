import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export function useAtendimentoActions() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const iniciarAtendimento = async (atendimentoId: string) => {
    setIsLoading(true);
    try {
      console.log('🚀 Iniciando atendimento:', atendimentoId);
      
      // 1. Atualizar status do atendimento para em_atendimento
      const { error: updateError } = await supabase
        .from('chamados')
        .update({ 
          status: 'em_atendimento',
          atualizado_em: new Date().toISOString()
        })
        .eq('id', atendimentoId);

      if (updateError) {
        throw new Error(`Erro ao atualizar status: ${updateError.message}`);
      }

      // 2. Chamar edge function para adicionar ao grupo WhatsApp
      const { error: groupError } = await supabase.functions.invoke('add-to-whatsapp-group', {
        body: { chamadoId: atendimentoId }
      });

      if (groupError) {
        console.error('❌ Erro ao adicionar ao grupo:', groupError);
        // Não falhar completamente se o grupo falhar, apenas avisar
        toast({
          title: "⚠️ Atendimento Iniciado com Aviso",
          description: "Atendimento iniciado, mas houve erro ao adicionar ao grupo WhatsApp",
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ Atendimento Iniciado",
          description: "Atendimento iniciado e adicionado ao grupo WhatsApp!",
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao iniciar atendimento:', error);
      toast({
        title: "❌ Erro ao Iniciar",
        description: error instanceof Error ? error.message : 'Erro ao iniciar atendimento',
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const finalizarAtendimento = async (atendimentoId: string, resolucao?: string) => {
    setIsLoading(true);
    try {
      console.log('🏁 Finalizando atendimento:', atendimentoId);
      
      // 1. Atualizar status do atendimento para finalizado
      const { error: updateError } = await supabase
        .from('chamados')
        .update({ 
          status: 'finalizado',
          resolucao: resolucao || 'Atendimento finalizado',
          atualizado_em: new Date().toISOString()
        })
        .eq('id', atendimentoId);

      if (updateError) {
        throw new Error(`Erro ao atualizar status: ${updateError.message}`);
      }

      // 2. Chamar edge function para remover do grupo WhatsApp
      const { error: groupError } = await supabase.functions.invoke('remove-from-whatsapp-group', {
        body: { chamadoId: atendimentoId }
      });

      if (groupError) {
        console.error('❌ Erro ao remover do grupo:', groupError);
        // Não falhar completamente se o grupo falhar, apenas avisar
        toast({
          title: "⚠️ Atendimento Finalizado com Aviso",
          description: "Atendimento finalizado, mas houve erro ao remover do grupo WhatsApp",
          variant: "destructive",
        });
      } else {
        toast({
          title: "✅ Atendimento Finalizado",
          description: "Atendimento finalizado e removido do grupo WhatsApp!",
        });
      }
      
      return true;
    } catch (error) {
      console.error('❌ Erro ao finalizar atendimento:', error);
      toast({
        title: "❌ Erro ao Finalizar",
        description: error instanceof Error ? error.message : 'Erro ao finalizar atendimento',
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const reativarAtendimento = async (atendimentoId: string) => {
    setIsLoading(true);
    try {
      console.log('🔄 Reativando atendimento:', atendimentoId);
      
      // Voltar para em_fila
      const { error: updateError } = await supabase
        .from('chamados')
        .update({ 
          status: 'em_fila',
          atualizado_em: new Date().toISOString()
        })
        .eq('id', atendimentoId);

      if (updateError) {
        throw new Error(`Erro ao atualizar status: ${updateError.message}`);
      }

      toast({
        title: "✅ Atendimento Reativado",
        description: "Atendimento reativado para a fila!",
      });
      return true;
    } catch (error) {
      console.error('❌ Erro ao reativar atendimento:', error);
      toast({
        title: "❌ Erro ao Reativar",
        description: error instanceof Error ? error.message : 'Erro ao reativar atendimento',
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    iniciarAtendimento,
    finalizarAtendimento,
    reativarAtendimento,
    isLoading
  };
}