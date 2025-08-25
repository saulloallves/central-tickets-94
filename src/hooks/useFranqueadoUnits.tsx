import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface FranqueadoUnit {
  id: string;
  grupo: string;
  cidade: string;
  uf: string;
}

export const useFranqueadoUnits = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [units, setUnits] = useState<FranqueadoUnit[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUnits = async () => {
    if (!user) return;

    try {
      setLoading(true);
      
      // Buscar o email do usuário
      const { data: profileData } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single();

      if (!profileData?.email) {
        console.log('Email do usuário não encontrado');
        return;
      }

      // Buscar as unidades do franqueado
      const { data: franqueadoData } = await supabase
        .from('franqueados')
        .select('unit_code')
        .eq('email', profileData.email)
        .single();

      if (!franqueadoData?.unit_code) {
        console.log('Franqueado não encontrado ou sem unidades');
        return;
      }

      // Extrair IDs das unidades do unit_code (jsonb)
      const unitIds = Object.keys(franqueadoData.unit_code);
      
      if (unitIds.length === 0) {
        console.log('Nenhuma unidade encontrada para o franqueado');
        return;
      }

      // Buscar detalhes das unidades
      const { data: unidadesData, error } = await supabase
        .from('unidades')
        .select('id, grupo, cidade, uf')
        .in('id', unitIds);

      if (error) {
        console.error('Erro ao buscar unidades:', error);
        toast({
          title: "Erro",
          description: "Falha ao carregar unidades",
          variant: "destructive"
        });
        return;
      }

      setUnits(unidadesData || []);
    } catch (error) {
      console.error('Erro ao buscar unidades do franqueado:', error);
      toast({
        title: "Erro",
        description: "Falha ao carregar dados das unidades",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUnits();
  }, [user]);

  return {
    units,
    loading,
    refetch: fetchUnits
  };
};