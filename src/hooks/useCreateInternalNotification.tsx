import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';

interface CreateNotificationParams {
  title: string;
  message?: string;
  type: 'ticket' | 'sla' | 'alert' | 'info' | 'crisis' | 'ticket_forwarded';
  equipe_id?: string;
  recipients?: string[]; // Optional: if not provided, will auto-derive from equipe_id
  payload?: Record<string, any>;
}

export const useCreateInternalNotification = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: CreateNotificationParams) => {
      // Criar notificação interna
      const { data, error } = await supabase.functions.invoke('create-internal-notification', {
        body: params,
      });

      if (error) {
        console.error('Error creating notification:', error);
        throw error;
      }

      // Enviar push notification via OneSignal (se tiver title e message)
      if (params.title && (params.message || params.payload)) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          
          await supabase.functions.invoke('send-push-notification', {
            body: {
              title: params.title,
              message: params.message || 'Nova notificação',
              userIds: params.recipients,
              equipeId: params.equipe_id,
              data: params.payload,
            },
            headers: {
              Authorization: `Bearer ${session?.access_token}`,
            },
          });
          console.log('✅ Push notification sent via OneSignal');
        } catch (pushError) {
          console.warn('Failed to send push notification (non-critical):', pushError);
          // Don't fail the whole operation if push fails
        }
      }

      return data;
    },
    onSuccess: (data) => {
      console.log('Notification created successfully:', data);
      
      // Invalidate all notification queries to trigger refetch
      queryClient.invalidateQueries({ 
        queryKey: ['internal-notifications'] 
      });

      toast({
        title: "Notificação enviada",
        description: `Notificação enviada para ${data.recipients_count} usuários`,
      });
    },
    onError: (error: any) => {
      console.error('Failed to create notification:', error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível enviar a notificação",
        variant: "destructive",
      });
    },
  });
};