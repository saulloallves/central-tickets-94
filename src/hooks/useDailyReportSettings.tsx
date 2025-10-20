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
      // Limpar e identificar tipo
      const input = phone.trim();
      const isGroup = input.endsWith('-group');
      
      // Remover sufixo -group temporariamente para validação
      const cleaned = input.replace(/-group$/, '').replace(/\D/g, '');
      
      // Validar comprimento
      const isPhoneNumber = cleaned.length >= 11 && cleaned.length <= 13;
      const isGroupId = cleaned.length >= 18 && cleaned.length <= 20;
      
      if (!isPhoneNumber && !isGroupId) {
        throw new Error(
          'Formato inválido. Use:\n' +
          '• Telefone: código do país + DDD + número (ex: 5511977256029)\n' +
          '• Grupo: ID do grupo + -group (ex: 120363632329453826@g.us-group)'
        );
      }
      
      // Salvar com formato correto
      const valueToSave = isGroup ? `${cleaned}-group` : cleaned;

      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'daily_report_phone',
          setting_value: valueToSave,
          updated_by: (await supabase.auth.getUser()).data.user?.id
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;
      return valueToSave;
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
    const input = phone.trim();
    const cleaned = input.replace(/-group$/, '').replace(/\D/g, '');
    
    const isPhoneNumber = cleaned.length >= 11 && cleaned.length <= 13;
    const isGroupId = cleaned.length >= 18 && cleaned.length <= 20;
    
    return isPhoneNumber || isGroupId;
  };

  return {
    reportPhone: reportPhone || '5511977256029',
    isLoading,
    updatePhone: updatePhoneMutation.mutate,
    isUpdating: updatePhoneMutation.isPending,
    isValidPhone
  };
}
