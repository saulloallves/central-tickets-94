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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const CleanupTicketsButton = () => {
  const { toast } = useToast();
  const [cleaning, setCleaning] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [stats, setStats] = useState<{
    tickets: number;
    mensagens: number;
    chamados: number;
  } | null>(null);
  const [open, setOpen] = useState(false);

  const fetchStats = async () => {
    try {
      const [ticketsRes, mensagensRes, chamadosRes] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true }),
        supabase.from('ticket_mensagens').select('id', { count: 'exact', head: true }),
        supabase.from('chamados').select('id', { count: 'exact', head: true }),
      ]);

      setStats({
        tickets: ticketsRes.count || 0,
        mensagens: mensagensRes.count || 0,
        chamados: chamadosRes.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      toast({
        title: "Erro ao carregar estatísticas",
        description: "Não foi possível carregar os dados",
        variant: "destructive",
      });
    }
  };

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      fetchStats();
      setConfirmText('');
    }
  };

  const handleCleanup = async () => {
    if (confirmText !== 'DELETAR TUDO') {
      toast({
        title: "Confirmação Incorreta",
        description: "Digite exatamente 'DELETAR TUDO' para confirmar",
        variant: "destructive",
      });
      return;
    }

    try {
      setCleaning(true);
      
      toast({
        title: "Iniciando Limpeza",
        description: "Removendo todos os tickets do banco de dados...",
      });

      const { data, error } = await supabase.functions.invoke('cleanup-test-data');

      if (error) throw error;

      toast({
        title: "✅ Limpeza Concluída",
        description: `${data?.summary || 'Todos os dados foram removidos com sucesso'}`,
      });

      setOpen(false);
      
      // Refresh da página após 1 segundo
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error: any) {
      console.error('Error cleaning up:', error);
      toast({
        title: "Erro na Limpeza",
        description: error.message || "Não foi possível remover os dados",
        variant: "destructive",
      });
    } finally {
      setCleaning(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpen}>
      <AlertDialogTrigger asChild>
        <Button 
          variant="destructive" 
          size="sm"
          disabled={cleaning}
          className="gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Deletar Todos os Tickets
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            ⚠️ ATENÇÃO: Ação Irreversível!
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <div className="text-foreground">
              Esta ação vai <strong>deletar permanentemente</strong> todos os dados de tickets:
            </div>
            
            {stats && (
              <div className="bg-muted p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tickets:</span>
                  <span className="font-semibold">{stats.tickets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mensagens:</span>
                  <span className="font-semibold">{stats.mensagens}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Chamados:</span>
                  <span className="font-semibold">{stats.chamados}</span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="confirm" className="text-foreground">
                Digite <strong>DELETAR TUDO</strong> para confirmar:
              </Label>
              <Input
                id="confirm"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETAR TUDO"
                className="font-mono"
                disabled={cleaning}
              />
            </div>

            <div className="text-sm text-destructive">
              Esta ação não pode ser desfeita!
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cleaning}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleCleanup}
            disabled={confirmText !== 'DELETAR TUDO' || cleaning}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {cleaning ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Deletando...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4 mr-2" />
                Confirmar Exclusão
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
