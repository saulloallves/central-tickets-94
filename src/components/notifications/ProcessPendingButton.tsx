import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';
export const ProcessPendingButton: React.FC = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const {
    toast
  } = useToast();
  const handleProcessPending = async () => {
    try {
      setIsProcessing(true);
      console.log('🔄 Processando notificações pendentes retroativamente...');
      
      const { data: pendingNotifications, error: fetchError } = await supabase
        .from('notifications_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });

      if (fetchError) {
        console.error('❌ Erro ao buscar notificações:', fetchError);
        throw fetchError;
      }

      if (!pendingNotifications || pendingNotifications.length === 0) {
        toast({
          title: "Nenhuma notificação pendente",
          description: "Não há notificações para processar",
          variant: "default"
        });
        return;
      }

      console.log(`📋 Encontradas ${pendingNotifications.length} notificações pendentes`);

      // Atualizar status para forçar reprocessamento via trigger
      const { error: updateError } = await supabase
        .from('notifications_queue')
        .update({ status: 'pending', updated_at: new Date().toISOString() })
        .eq('status', 'pending')
        .in('id', pendingNotifications.map(n => n.id));

      if (updateError) {
        console.error('❌ Erro ao atualizar notificações:', updateError);
        throw updateError;
      }

      toast({
        title: "Notificações Reprocessadas",
        description: `${pendingNotifications.length} notificações foram enviadas para reprocessamento`,
        variant: "default"
      });
    } catch (error: any) {
      console.error('💥 Erro ao processar notificações pendentes:', error);
      toast({
        title: "Erro",
        description: `Erro ao processar notificações: ${error.message || 'Erro desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };
  return (
    <Button
      onClick={handleProcessPending}
      disabled={isProcessing}
      variant="outline"
      size="sm"
    >
      <RefreshCw className={`h-4 w-4 ${isProcessing ? 'animate-spin' : ''}`} />
    </Button>
  );
};