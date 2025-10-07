import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PlayCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const ForceResumeSLAButton = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleForceResume = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke('pause-sla-processor', {
        body: { action: 'resume' }
      });

      if (error) throw error;

      toast({
        title: '✅ SLAs Despausados',
        description: `${data.tickets_despausados} tickets foram despausados com sucesso.`,
      });

      // Recarregar a página para mostrar os tickets atualizados
      setTimeout(() => window.location.reload(), 1500);

    } catch (error) {
      console.error('Erro ao despausar SLAs:', error);
      toast({
        title: 'Erro ao despausar SLAs',
        description: error instanceof Error ? error.message : 'Erro desconhecido',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      onClick={handleForceResume}
      disabled={loading}
      variant="outline"
      size="sm"
      className="gap-2"
    >
      <PlayCircle className="w-4 h-4" />
      {loading ? 'Despausando...' : 'Forçar Despausar SLAs'}
    </Button>
  );
};
