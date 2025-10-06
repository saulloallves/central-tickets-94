import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface NotificationSourceConfig {
  id: string;
  notification_type: string;
  source_type: 'column' | 'fixed' | 'dynamic';
  source_table?: string;
  source_column?: string;
  fixed_value?: string;
  filter_column?: string;
  filter_value_source?: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const useNotificationSourceConfig = () => {
  const [configs, setConfigs] = useState<NotificationSourceConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notification_source_config')
        .select('*')
        .order('notification_type', { ascending: true });

      if (error) throw error;

      setConfigs((data || []).map(item => ({
        ...item,
        source_type: item.source_type as 'column' | 'fixed' | 'dynamic'
      })));
      console.log('Notification source configs loaded:', data?.length);
    } catch (error) {
      console.error('Error fetching notification source configs:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações de origem",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (id: string, updates: Partial<NotificationSourceConfig>) => {
    try {
      const { error } = await supabase
        .from('notification_source_config')
        .update(updates)
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Configuração atualizada",
        description: "Configuração de origem foi atualizada com sucesso",
      });

      fetchConfigs();
    } catch (error) {
      console.error('Error updating notification source config:', error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a configuração",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  return {
    configs,
    loading,
    updateConfig,
    refetch: fetchConfigs
  };
};