
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface NotificationRoute {
  id: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  unit_id?: string;
  type: string;
  destination_value: string;
  destination_label?: string;
  description?: string;
  priority: number;
}

export const useNotificationRoutes = () => {
  const [routes, setRoutes] = useState<NotificationRoute[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchRoutes = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_routes')
        .select('*')
        .order('type', { ascending: true })
        .order('priority', { ascending: false });

      if (error) throw error;

      setRoutes(data || []);
      console.log('Notification routes loaded:', data?.length);
    } catch (error) {
      console.error('Error fetching notification routes:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as rotas de notificação",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveRoute = async (route: Omit<NotificationRoute, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { error } = await supabase
        .from('notification_routes')
        .insert([route]);

      if (error) throw error;

      toast({
        title: "Rota criada",
        description: "Nova rota de notificação foi criada com sucesso",
      });

      fetchRoutes();
    } catch (error) {
      console.error('Error creating notification route:', error);
      toast({
        title: "Erro",
        description: "Não foi possível criar a rota de notificação",
        variant: "destructive",
      });
    }
  };

  const updateRoute = async (id: string, updates: Partial<NotificationRoute>) => {
    try {
      const { error } = await supabase
        .from('notification_routes')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Rota atualizada",
        description: "Rota de notificação foi atualizada com sucesso",
      });

      fetchRoutes();
    } catch (error) {
      console.error('Error updating notification route:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a rota de notificação",
        variant: "destructive",
      });
    }
  };

  const deleteRoute = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notification_routes')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Rota removida",
        description: "Rota de notificação foi removida com sucesso",
      });

      fetchRoutes();
    } catch (error) {
      console.error('Error deleting notification route:', error);
      toast({
        title: "Erro",
        description: "Não foi possível remover a rota de notificação",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchRoutes();
  }, []);

  return {
    routes,
    loading,
    saveRoute,
    updateRoute,
    deleteRoute,
    refetch: fetchRoutes
  };
};
