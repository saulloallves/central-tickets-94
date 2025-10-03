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

      // Extrair códigos de grupo das unidades do unit_code (jsonb)
      const unitCode = franqueadoData.unit_code;
      let groupCodes: number[] = [];
      
      // Handle different formats of unit_code
      if (Array.isArray(unitCode)) {
        groupCodes = unitCode.map(code => Number(code)).filter(code => !isNaN(code));
      } else if (typeof unitCode === 'object' && unitCode !== null) {
        groupCodes = Object.keys(unitCode).map(code => Number(code)).filter(code => !isNaN(code));
      } else {
        console.log('Formato de unit_code não reconhecido:', unitCode);
        return;
      }
      
      if (groupCodes.length === 0) {
        console.log('Nenhum código de grupo encontrado para o franqueado');
        return;
      }

      console.log('Códigos de grupo encontrados:', groupCodes);

      // Buscar detalhes das unidades por codigo_grupo
      const { data: unidadesData, error } = await supabase
        .from('unidades')
        .select('id, grupo, cidade, uf, codigo_grupo')
        .in('codigo_grupo', groupCodes.map(String));

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