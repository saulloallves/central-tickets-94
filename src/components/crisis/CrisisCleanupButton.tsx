import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CheckCircle, Loader2, RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function CrisisCleanupButton() {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleCleanup = async () => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-orphaned-crises');
      
      if (error) {
        console.error('Erro na limpeza:', error);
        toast({
          title: "Erro",
          description: "Não foi possível executar a limpeza de crises",
          variant: "destructive",
        });
        return;
      }

      const result = data;
      
      if (result.success) {
        toast({
          title: "Limpeza Concluída",
          description: result.message,
          variant: "default",
        });
        
        // Recarregar a página para atualizar os dados
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        toast({
          title: "Erro",
          description: "Falha na limpeza de crises órfãs",
          variant: "destructive",
        });
      }
      
    } catch (error) {
      console.error('Erro ao executar limpeza:', error);
      toast({
        title: "Erro",
        description: "Erro interno ao executar a limpeza",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleCleanup}
      disabled={isLoading}
      className="text-xs"
    >
      {isLoading ? (
        <>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Limpando...
        </>
      ) : (
        <>
          <RefreshCw className="h-3 w-3 mr-1" />
          Limpar Crises Órfãs
        </>
      )}
    </Button>
  );
}