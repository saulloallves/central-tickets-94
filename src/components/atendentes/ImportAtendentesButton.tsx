import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

export const ImportAtendentesButton = () => {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);

  const handleImport = async () => {
    try {
      setImporting(true);
      
      toast({
        title: "Iniciando Importação",
        description: "Processando todas as unidades...",
      });

      const { data, error } = await supabase.functions.invoke('import-atendentes-unidades');

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Importação Concluída",
          description: `${data.stats.criados} atendentes criados, ${data.stats.atualizados} atualizados, ${data.stats.associacoes} associações criadas`,
        });

        // Recarregar a página para mostrar os novos dados
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        throw new Error(data.message || 'Erro na importação');
      }

    } catch (error) {
      console.error('Error importing:', error);
      toast({
        title: "Erro na Importação",
        description: "Não foi possível importar os atendentes",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Button 
      onClick={handleImport}
      disabled={importing}
      className="gap-2"
      variant="default"
    >
      {importing ? (
        <RefreshCw className="h-4 w-4 animate-spin" />
      ) : (
        <Download className="h-4 w-4" />
      )}
      {importing ? 'Importando...' : 'Importar Todas as Unidades'}
    </Button>
  );
};