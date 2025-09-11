import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { BulkAnalysisDialog } from './BulkAnalysisDialog';
import { Brain, ChevronDown } from 'lucide-react';

interface Equipe {
  id: string;
  nome: string;
  ativo: boolean;
}

interface BulkAnalysisButtonProps {
  equipes: Equipe[];
  className?: string;
}

export const BulkAnalysisButton = ({ equipes, className }: BulkAnalysisButtonProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedEquipe, setSelectedEquipe] = useState<Equipe | null>(null);

  const handleSelectEquipe = (equipe: Equipe) => {
    setSelectedEquipe(equipe);
    setDialogOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className={className}>
            <Brain className="h-4 w-4 mr-2" />
            Análise IA
            <ChevronDown className="h-4 w-4 ml-1" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Analisar tickets da equipe</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {equipes.length > 0 ? (
            equipes.map((equipe) => (
              <DropdownMenuItem
                key={equipe.id}
                onClick={() => handleSelectEquipe(equipe)}
                className="cursor-pointer"
              >
                <Brain className="h-4 w-4 mr-2" />
                {equipe.nome}
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>
              Nenhuma equipe disponível
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {selectedEquipe && (
        <BulkAnalysisDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          equipeId={selectedEquipe.id}
          equipeNome={selectedEquipe.nome}
        />
      )}
    </>
  );
};