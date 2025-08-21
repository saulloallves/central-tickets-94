import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface LegacyNotificationDefault {
  id: string;
  unidade_id: string;
  grupo_branco?: string;
  franqueado_phone?: string;
  franqueado_name?: string;
}

export const useLegacyNotificationDefaults = () => {
  const [defaults, setDefaults] = useState<LegacyNotificationDefault[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const fetchDefaults = async () => {
    setLoading(true);
    try {
      // Fetch unidades with their id_grupo_branco
      const { data: unidadesData, error: unidadesError } = await supabase
        .from('unidades')
        .select('id, id_grupo_branco')
        .not('id_grupo_branco', 'is', null);

      if (unidadesError) throw unidadesError;

      // Fetch franqueados with their phone and name
      const { data: franqueadosData, error: franqueadosError } = await supabase
        .from('franqueados')
        .select('phone, name, unit_code')
        .not('phone', 'is', null);

      if (franqueadosError) throw franqueadosError;

      // Combine the data
      const combined: LegacyNotificationDefault[] = [];
      
      // Process unidades
      if (unidadesData) {
        unidadesData.forEach(unidade => {
          if (unidade.id_grupo_branco) {
            const existing = combined.find(item => item.unidade_id === unidade.id);
            if (existing) {
              existing.grupo_branco = unidade.id_grupo_branco;
            } else {
              combined.push({
                id: unidade.id,
                unidade_id: unidade.id,
                grupo_branco: unidade.id_grupo_branco
              });
            }
          }
        });
      }

      // Process franqueados
      if (franqueadosData) {
        franqueadosData.forEach(franqueado => {
          if (franqueado.unit_code && franqueado.phone) {
            // unit_code is JSONB, we need to extract the keys
            const unitCodes = Object.keys(franqueado.unit_code || {});
            unitCodes.forEach(unitId => {
              const existing = combined.find(item => item.unidade_id === unitId);
              if (existing) {
                existing.franqueado_phone = franqueado.phone;
                existing.franqueado_name = franqueado.name;
              } else {
                combined.push({
                  id: unitId,
                  unidade_id: unitId,
                  franqueado_phone: franqueado.phone,
                  franqueado_name: franqueado.name
                });
              }
            });
          }
        });
      }

      setDefaults(combined);
      console.log('Legacy notification defaults loaded:', combined.length);
    } catch (error) {
      console.error('Error fetching legacy notification defaults:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações atuais do sistema",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDefaults();
  }, []);

  return {
    defaults,
    loading,
    refetch: fetchDefaults
  };
};