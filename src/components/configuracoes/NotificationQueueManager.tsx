import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, Send, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

export function NotificationQueueManager() {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const { data: pendingNotifications, refetch, isLoading } = useQuery({
    queryKey: ['pending-notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications_queue')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });

  const processPendingNotifications = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-pending-notifications');
      
      if (error) {
        console.error('Error processing notifications:', error);
        toast({
          title: "Erro ao processar notificações",
          description: error.message || "Erro desconhecido",
          variant: "destructive",
        });
      } else {
        console.log('Processing result:', data);
        toast({
          title: "Notificações processadas",
          description: data.message || "Processamento concluído com sucesso",
        });
        refetch();
      }
    } catch (error) {
      console.error('Unexpected error:', error);
      toast({
        title: "Erro inesperado",
        description: "Erro ao chamar a função de processamento",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Send className="h-5 w-5" />
          Fila de Notificações
        </CardTitle>
        <CardDescription>
          Gerencie notificações pendentes e force o processamento manual se necessário
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Notificações pendentes:</span>
            <Badge variant={pendingNotifications?.length ? "destructive" : "secondary"}>
              {isLoading ? "Carregando..." : pendingNotifications?.length || 0}
            </Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {pendingNotifications && pendingNotifications.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Existem notificações pendentes que não foram enviadas
              </span>
            </div>
            
            <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
              {pendingNotifications.slice(0, 5).map((notification) => (
                <div key={notification.id} className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{notification.type}</span>
                    {notification.ticket_id && (
                      <span className="text-muted-foreground ml-2">
                        Ticket: {
                          (notification.payload as any)?.codigo_ticket || 
                          notification.ticket_id.slice(0, 8)
                        }
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(notification.created_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              ))}
              {pendingNotifications.length > 5 && (
                <div className="text-xs text-muted-foreground text-center">
                  E mais {pendingNotifications.length - 5} notificações...
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={processPendingNotifications}
                disabled={processing}
                className="flex-1"
                size="sm"
              >
                {processing ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                {processing ? 'Processando...' : 'Processar Agora'}
              </Button>
              <Button
                onClick={async () => {
                  try {
                    await supabase.functions.invoke('notification-scheduler');
                    toast({
                      title: "Agendador executado",
                      description: "Verificação automática de notificações executada",
                    });
                    refetch();
                  } catch (error) {
                    console.error('Error running scheduler:', error);
                    toast({
                      title: "Erro",
                      description: "Erro ao executar agendador",
                      variant: "destructive",
                    });
                  }
                }}
                variant="outline"
                size="sm"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {pendingNotifications && pendingNotifications.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-4">
            ✅ Todas as notificações foram processadas
          </div>
        )}
      </CardContent>
    </Card>
  );
}