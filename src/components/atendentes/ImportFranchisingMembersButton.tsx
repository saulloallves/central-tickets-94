import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';

export const ImportFranchisingMembersButton = () => {
  const { toast } = useToast();
  const [importing, setImporting] = useState(false);
  const [open, setOpen] = useState(false);

  const handleImport = async () => {
    try {
      setImporting(true);
      
      toast({
        title: "Iniciando Importação",
        description: "Processando membros do franchising...",
      });

      // Dados mockados do SQL - em produção você leria de um arquivo
      const membersData = [
        // Aqui você colaria os dados parseados do SQL
        // Por exemplo, após processar o INSERT do arquivo
      ];

      const { data, error } = await supabase.functions.invoke('import-franchising-members', {
        body: { members: membersData }
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Importação Concluída",
          description: data.message,
        });
        setOpen(false);
      } else {
        throw new Error(data.error || 'Erro na importação');
      }

    } catch (error: any) {
      console.error('Error importing:', error);
      toast({
        title: "Erro na Importação",
        description: error.message || "Não foi possível importar os membros",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar Franchising Members
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Usuários do Franchising</DialogTitle>
          <DialogDescription>
            Esta ação criará usuários no sistema a partir da tabela franchising_members.
            Os usuários receberão emails para definir suas senhas e escolher equipes.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <strong>⚠️ Atenção:</strong>
              <br />
              • Apenas membros com status "active" serão importados
              <br />
              • Usuários já existentes serão ignorados
              <br />
              • Emails de boas-vindas serão enviados automaticamente
            </p>
          </div>
          <Button
            onClick={handleImport}
            disabled={importing}
            className="w-full gap-2"
          >
            {importing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Confirmar Importação
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
