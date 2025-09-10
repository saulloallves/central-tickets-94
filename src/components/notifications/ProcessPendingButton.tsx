import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw } from 'lucide-react';
export const ProcessPendingButton = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const {
    toast
  } = useToast();
  const handleProcessPending = async () => {
    try {
      setIsProcessing(true);
      console.log('🔄 Forçando processamento de notificações pendentes...');
      const {
        data,
        error
      } = await supabase.functions.invoke('process-pending-notifications');
      if (error) {
        console.error('❌ Erro ao processar notificações:', error);
        throw error;
      }
      console.log('✅ Resultado do processamento:', data);
      toast({
        title: "Notificações Processadas",
        description: `${data.processed} notificações foram processadas com sucesso`,
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