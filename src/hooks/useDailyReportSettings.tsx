import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export function useDailyReportSettings() {
  const queryClient = useQueryClient();

  const { data: reportPhone, isLoading } = useQuery({
    queryKey: ['daily-report-phone'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'daily_report_phone')
        .maybeSingle();

      if (error) {
        console.error('Error fetching report phone:', error);
        return '5511977256029'; // Fallback padrão
      }

      return data?.setting_value || '5511977256029';
    },
  });

  const updatePhoneMutation = useMutation({
    mutationFn: async (phone: string) => {
      // Validar formato
      const cleaned = phone.replace(/\D/g, '');
      if (cleaned.length < 11 || cleaned.length > 13) {
        throw new Error('Formato inválido. Use: código do país + DDD + número (ex: 5511977256029)');
      }

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'daily_report_phone',
          setting_value: cleaned,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;
      return cleaned;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['daily-report-phone'] });
      toast({
        title: "✅ Número atualizado!",
        description: "O número de destino do relatório diário foi atualizado.",
      });
    },
    onError: (error: any) => {
      console.error('Error updating report phone:', error);
      toast({
        title: "❌ Erro ao atualizar",
        description: error.message || "Não foi possível atualizar o número.",
        variant: "destructive"
      });
    }
  });

  const isValidPhone = (phone: string): boolean => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length >= 11 && cleaned.length <= 13;
  };

  return {
    reportPhone: reportPhone || '5511977256029',
    isLoading,
    updatePhone: updatePhoneMutation.mutate,
    isUpdating: updatePhoneMutation.isPending,
    isValidPhone
  };
}
