import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useSystemSettings() {
  const queryClient = useQueryClient();

  const { data: logoUrl, isLoading } = useQuery({
    queryKey: ['system-logo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'system_logo_url')
        .single();

      if (error) {
        console.error('Error fetching system logo:', error);
        return '';
      }

      return data?.setting_value || '';
    },
  });

  const updateLogoMutation = useMutation({
    mutationFn: async (logoUrl: string) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'system_logo_url',
          setting_value: logoUrl,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;
      return logoUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-logo'] });
      toast({
        title: "Logo atualizado!",
        description: "O logo do sistema foi atualizado para todos os usuários.",
      });
    },
    onError: (error) => {
      console.error('Error updating logo:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar o logo do sistema.",
        variant: "destructive"
      });
    }
  });

  return {
    logoUrl: logoUrl || '',
    isLoading,
    updateLogo: updateLogoMutation.mutate,
    isUpdating: updateLogoMutation.isPending
  };
}