import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

export const useProcessPendingNotifications = () => {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('process-pending-notifications');

      if (error) {
        console.error('Error processing notifications:', error);
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('Notifications processed successfully:', data);
      
      toast({
        title: "Notificações processadas",
        description: `${data.processed} notificações foram processadas com sucesso`,
      });
    },
    onError: (error: any) => {
      console.error('Failed to process notifications:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível processar as notificações",
        variant: "destructive",
      });
    },
  });
};