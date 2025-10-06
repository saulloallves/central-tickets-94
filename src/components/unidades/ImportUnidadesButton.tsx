import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Upload, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function ImportUnidadesButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const handleImport = async () => {
    setIsImporting(true);
    
    try {
      toast.info("Lendo arquivo CSV...");
      
      // Fetch the CSV file from public folder
      const csvResponse = await fetch('/data/unidades_rows_8.csv');
      if (!csvResponse.ok) {
        throw new Error('Arquivo CSV não encontrado em /public/data/');
      }
      
      const csvContent = await csvResponse.text();
      
      toast.info("Enviando dados para processamento...");
      
      const { data, error } = await supabase.functions.invoke(
        "import-unidades-from-csv",
        { 
          method: "POST",
          body: { csvContent }
        }
      );

      if (error) {
        throw error;
      }

      if (data?.success) {
        toast.success(data.message || "Importação concluída com sucesso!", {
          description: `${data.stats.created} criadas, ${data.stats.updated} atualizadas${
            data.stats.errors > 0 ? `, ${data.stats.errors} erros` : ""
          }`,
        });
        setIsOpen(false);
        
        // Reload page to show new data
        setTimeout(() => window.location.reload(), 1500);
      } else {
        throw new Error(data?.error || "Erro desconhecido na importação");
      }
    } catch (error: any) {
      console.error("Erro na importação:", error);
      toast.error("Erro ao importar unidades", {
        description: error.message || "Tente novamente mais tarde",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="mr-2 h-4 w-4" />
          Importar do CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Unidades do CSV</DialogTitle>
          <DialogDescription>
            Esta ação importará todas as unidades do arquivo CSV. Os dados
            existentes serão atualizados se o ID já existir.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="rounded-lg border border-warning/50 bg-warning/10 p-4">
            <p className="text-sm font-medium">⚠️ Atenção:</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>• Esta operação pode levar alguns minutos</li>
              <li>• Unidades existentes serão atualizadas</li>
              <li>• Novas unidades serão criadas</li>
              <li>• A página será recarregada após a importação</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setIsOpen(false)}
            disabled={isImporting}
          >
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              "Confirmar Importação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
