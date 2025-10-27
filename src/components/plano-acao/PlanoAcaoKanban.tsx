import React, { memo } from 'react';
import { 
  Circle, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Building2,
  User,
  Calendar
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { PlanoAcao } from '@/hooks/usePlanoAcao';
import { formatDateBR } from '@/lib/date-utils';

interface PlanoAcaoKanbanProps {
  planos: PlanoAcao[];
  onPlanoSelect: (plano: PlanoAcao) => void;
  selectedPlanoId: string | null;
  onChangeStatus: (planoId: string, newStatus: string) => Promise<boolean>;
}

const COLUMN_STATUS = {
  aberto: 'Aberto',
  pendente: 'Pendente',
  em_andamento: 'Em Andamento',
  reaberto: 'Reaberto',
  concluido: 'Concluído'
};

const COLUMN_ICONS = {
  aberto: Circle,
  pendente: Clock,
  em_andamento: AlertTriangle,
  reaberto: RotateCcw,
  concluido: CheckCircle2
};

const COLUMN_COLORS = {
  aberto: 'border-border bg-background',
  pendente: 'border-border bg-background',
  em_andamento: 'border-border bg-background',
  reaberto: 'border-border bg-background',
  concluido: 'border-border bg-background'
};

const ICON_COLORS = {
  aberto: 'text-blue-500',
  pendente: 'text-yellow-500',
  em_andamento: 'text-orange-500',
  reaberto: 'text-red-500',
  concluido: 'text-green-500'
};

const getCategoryEmoji = (categoria: string | null) => {
  if (!categoria) return '📋';
  const match = categoria.match(/^([\u{1F300}-\u{1F9FF}])/u);
  return match ? match[1] : '📋';
};

// Helper function to format date consistently
const formatPrazo = (prazo: string | null): string => {
  if (!prazo) return '-';
  
  // Se já está no formato dd/MM/yyyy, retorna direto
  if (prazo.includes('/')) return prazo;
  
  // Se está no formato ISO (yyyy-MM-dd), converte para formato BR
  try {
    return formatDateBR(prazo);
  } catch {
    return prazo; // Fallback: retorna como veio
  }
};

interface PlanoCardProps {
  plano: PlanoAcao;
  isSelected: boolean;
  onSelect: (plano: PlanoAcao) => void;
}

const PlanoCard = memo(({ plano, isSelected, onSelect }: PlanoCardProps) => {
  return (
    <div
      onClick={() => onSelect(plano)}
      className={cn(
        'cursor-pointer transition-all',
        isSelected && 'ring-2 ring-primary'
      )}
    >
      <Card className="hover:shadow-lg border border-slate-300 dark:border-slate-700 shadow-sm bg-card">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-sm line-clamp-2">
              {plano.titulo || 'Sem título'}
            </p>
            <span className="text-lg shrink-0">
              {getCategoryEmoji(plano.categoria)}
            </span>
          </div>

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" />
            <span className="truncate">
              {plano.unidade?.name || `Código ${plano.codigo_grupo}`}
            </span>
          </div>

          {plano.responsavel_local && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{plano.responsavel_local}</span>
            </div>
          )}

          {plano.prazo && (
            <div className="flex items-center gap-1 text-xs">
              <Calendar className="h-3 w-3" />
              <span>{formatPrazo(plano.prazo)}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

PlanoCard.displayName = 'PlanoCard';

interface KanbanColumnProps {
  status: keyof typeof COLUMN_STATUS;
  planos: PlanoAcao[];
  selectedPlanoId: string | null;
  onPlanoSelect: (plano: PlanoAcao) => void;
}

const KanbanColumn = ({ status, planos, selectedPlanoId, onPlanoSelect }: KanbanColumnProps) => {
  const Icon = COLUMN_ICONS[status];
  
  return (
    <div
      className={cn(
        'flex flex-col border-2 rounded-lg transition-colors h-full',
        COLUMN_COLORS[status]
      )}
    >
      <div className="p-3 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn("h-4 w-4", ICON_COLORS[status])} />
          <span className="font-semibold text-sm">{COLUMN_STATUS[status]}</span>
        </div>
        <Badge variant="secondary">{planos.length}</Badge>
      </div>

      <ScrollArea className="flex-1 p-2">
        <div className="space-y-2">
          {planos.map((plano) => (
            <PlanoCard
              key={plano.id}
              plano={plano}
              isSelected={selectedPlanoId === plano.id}
              onSelect={onPlanoSelect}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

export const PlanoAcaoKanban = ({
  planos,
  onPlanoSelect,
  selectedPlanoId,
}: PlanoAcaoKanbanProps) => {
  const getPlanosByStatus = (status: string) => {
    return planos.filter(p => p.status_frnq === status);
  };

  return (
    <div className="grid grid-cols-5 gap-4 h-[calc(100vh-250px)]">
      {Object.keys(COLUMN_STATUS).map((status) => (
        <KanbanColumn
          key={status}
          status={status as keyof typeof COLUMN_STATUS}
          planos={getPlanosByStatus(status)}
          selectedPlanoId={selectedPlanoId}
          onPlanoSelect={onPlanoSelect}
        />
      ))}
    </div>
  );
};
