import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { User, Users } from 'lucide-react';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface Atendente {
  id: string;
  nome: string;
  tipo: string;
}

interface AtendentesFilterProps {
  atendentes: Atendente[];
  selectedAtendenteId: string | null;
  onSelectAtendente: (id: string | null) => void;
  atendimentosCounts?: Record<string, number>;
}

export function AtendentesFilter({ 
  atendentes, 
  selectedAtendenteId, 
  onSelectAtendente,
  atendimentosCounts = {}
}: AtendentesFilterProps) {
  const totalAtendimentos = Object.values(atendimentosCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="mb-6">
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-2 pb-2">
          <Button
            variant={selectedAtendenteId === null ? "default" : "outline"}
            size="sm"
            onClick={() => onSelectAtendente(null)}
            className="flex items-center gap-2 shrink-0"
          >
            <Users className="h-4 w-4" />
            Todos
            {totalAtendimentos > 0 && (
              <Badge variant="secondary" className="ml-1">
                {totalAtendimentos}
              </Badge>
            )}
          </Button>

          {atendentes.map((atendente) => {
            const count = atendimentosCounts[atendente.id] || 0;
            return (
              <Button
                key={atendente.id}
                variant={selectedAtendenteId === atendente.id ? "default" : "outline"}
                size="sm"
                onClick={() => onSelectAtendente(atendente.id)}
                className="flex items-center gap-2 shrink-0"
              >
                <User className="h-4 w-4" />
                {atendente.nome}
                {count > 0 && (
                  <Badge variant="secondary" className="ml-1">
                    {count}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
