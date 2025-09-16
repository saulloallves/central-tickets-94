import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export const CleanupAtendentesButton = () => {
  const { toast } = useToast();
  const [cleaning, setCleaning] = useState(false);

  const handleCleanup = async () => {
    try {
      setCleaning(true);
      
      toast({
        title: "Limpando Atendentes",
        description: "Removendo atendentes criados automaticamente...",
      });

      // Buscar atendentes que foram criados automaticamente (contêm "Atendente" no nome)
      const { data: atendentesParaRemover, error: fetchError } = await supabase
        .from('atendentes')
        .select('id, nome')
        .like('nome', '%Atendente %')
        .not('nome', 'like', '%concierge%');

      if (fetchError) throw fetchError;

      if (!atendentesParaRemover || atendentesParaRemover.length === 0) {
        toast({
          title: "Nenhum Atendente para Limpar",
          description: "Não foram encontrados atendentes criados automaticamente",
        });
        return;
      }

      console.log(`🗑️ Removendo ${atendentesParaRemover.length} atendentes criados automaticamente`);

      // Primeiro remover associações
      const atendenteIds = atendentesParaRemover.map(a => a.id);
      
      const { error: deleteAssocError } = await supabase
        .from('atendente_unidades')
        .delete()
        .in('atendente_id', atendenteIds);

      if (deleteAssocError) {
        console.warn('Erro removendo associações:', deleteAssocError);
      }

      // Depois remover os atendentes
      const { error: deleteError } = await supabase
        .from('atendentes')
        .delete()
        .in('id', atendenteIds);

      if (deleteError) throw deleteError;

      toast({
        title: "Limpeza Concluída",
        description: `${atendentesParaRemover.length} atendentes removidos com sucesso`,
      });

      // Refresh da página
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('Error cleaning up:', error);
      toast({
        title: "Erro na Limpeza",
        description: "Não foi possível remover os atendentes",
        variant: "destructive",
      });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button 
          variant="destructive" 
          size="sm"
          disabled={cleaning}
          className="gap-2"
        >
          {cleaning ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Limpando...
            </>
          ) : (
            <>
              <Trash2 className="h-4 w-4" />
              Limpar Atendentes Criados Automaticamente
            </>
          )}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Confirmar Limpeza</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação irá remover todos os atendentes que foram criados automaticamente com nomes como "Atendente AGUAÍ", "Atendente ADAMANTINA", etc.
            <br /><br />
            Esta ação é <strong>irreversível</strong>. Deseja continuar?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={handleCleanup}>
            Sim, Limpar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};