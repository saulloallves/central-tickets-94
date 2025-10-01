import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

export interface EmergencyNumber {
  name: string;
  phone: string;
}

export function useEmergencySettings() {
  const queryClient = useQueryClient();

  const { data: emergencyNumbers = [], isLoading } = useQuery({
    queryKey: ['emergency-numbers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'emergency_numbers')
        .maybeSingle();

      if (error) {
        console.error('Error fetching emergency numbers:', error);
        return [];
      }

      if (!data?.setting_value) {
        return [];
      }

      try {
        const parsed = JSON.parse(data.setting_value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    },
  });

  const updateNumbersMutation = useMutation({
    mutationFn: async (numbers: EmergencyNumber[]) => {
      const { error } = await supabase
        .from('system_settings')
        .upsert({
          setting_key: 'emergency_numbers',
          setting_value: JSON.stringify(numbers),
          updated_by: (await supabase.auth.getUser()).data.user?.id
        }, {
          onConflict: 'setting_key'
        });

      if (error) throw error;
      return numbers;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['emergency-numbers'] });
      toast({
        title: "Números atualizados!",
        description: "As configurações de emergência foram atualizadas com sucesso.",
      });
    },
    onError: (error) => {
      console.error('Error updating emergency numbers:', error);
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível atualizar os números de emergência.",
        variant: "destructive"
      });
    }
  });

  const addNumber = (number: EmergencyNumber) => {
    const updatedNumbers = [...emergencyNumbers, number];
    updateNumbersMutation.mutate(updatedNumbers);
  };

  const removeNumber = (index: number) => {
    const updatedNumbers = emergencyNumbers.filter((_, i) => i !== index);
    updateNumbersMutation.mutate(updatedNumbers);
  };

  const updateNumber = (index: number, number: EmergencyNumber) => {
    const updatedNumbers = [...emergencyNumbers];
    updatedNumbers[index] = number;
    updateNumbersMutation.mutate(updatedNumbers);
  };

  return {
    emergencyNumbers,
    isLoading,
    addNumber,
    removeNumber,
    updateNumber,
    isUpdating: updateNumbersMutation.isPending
  };
}
