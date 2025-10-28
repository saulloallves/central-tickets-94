import React, { memo, useMemo } from 'react';
import { 
  Circle, 
  Clock, 
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
  Building2,
  User,
  Calendar,
  type LucideIcon
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
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

interface ColumnConfig {
  id: string;
  title: string;
  icon: LucideIcon;
  color: string;
  iconColor: string;
}

const COLUMNS: ColumnConfig[] = [
  {
    id: 'aberto',
    title: 'Aberto',
    icon: Circle,
    color: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    iconColor: 'text-blue-600 dark:text-blue-400'
  },
  {
    id: 'pendente',
    title: 'Pendente',
    icon: Clock,
    color: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
    iconColor: 'text-yellow-600 dark:text-yellow-400'
  },
  {
    id: 'em_andamento',
    title: 'Em Andamento',
    icon: AlertTriangle,
    color: 'bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800',
    iconColor: 'text-orange-600 dark:text-orange-400'
  },
  {
    id: 'reaberto',
    title: 'Reaberto',
    icon: RotateCcw,
    color: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
    iconColor: 'text-red-600 dark:text-red-400'
  },
  {
    id: 'concluido',
    title: 'Concluído',
    icon: CheckCircle2,
    color: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    iconColor: 'text-green-600 dark:text-green-400'
  }
];

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
    <Card
      onClick={() => onSelect(plano)}
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md border-l-4 border-l-primary",
        isSelected && "ring-2 ring-primary shadow-md"
      )}
    >
      <CardContent className="p-0 space-y-2">
        {plano.codigo_plano && (
          <div className="text-xs font-mono text-primary font-semibold">
            {plano.codigo_plano}
          </div>
        )}
        
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
  );
});

PlanoCard.displayName = 'PlanoCard';

interface KanbanColumnProps {
  config: ColumnConfig;
  planos: PlanoAcao[];
  selectedPlanoId: string | null;
  onPlanoSelect: (plano: PlanoAcao) => void;
}

const KanbanColumn = ({ config, planos, selectedPlanoId, onPlanoSelect }: KanbanColumnProps) => {
  const Icon = config.icon;
  
  return (
    <div className="flex flex-col h-full min-w-[280px] w-full">
      <div className={cn(
        "p-4 border-b-2 rounded-t-lg",
        config.color
      )}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-5 w-5", config.iconColor)} />
            <h3 className="font-semibold text-sm">{config.title}</h3>
          </div>
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-background text-xs font-semibold">
            {planos.length}
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1 bg-muted/30 rounded-b-lg">
        <div className="p-3 space-y-3 min-h-[500px]">
          {planos.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Nenhum plano
            </div>
          ) : (
            planos.map((plano) => (
              <PlanoCard
                key={plano.id}
                plano={plano}
                isSelected={selectedPlanoId === plano.id}
                onSelect={onPlanoSelect}
              />
            ))
          )}
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
  const groupedPlanos = useMemo(() => {
    return {
      aberto: planos.filter(p => p.status_frnq === 'aberto'),
      pendente: planos.filter(p => p.status_frnq === 'pendente'),
      em_andamento: planos.filter(p => p.status_frnq === 'em_andamento'),
      reaberto: planos.filter(p => p.status_frnq === 'reaberto'),
      concluido: planos.filter(p => p.status_frnq === 'concluido')
    };
  }, [planos]);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            config={column}
            planos={groupedPlanos[column.id as keyof typeof groupedPlanos]}
            selectedPlanoId={selectedPlanoId}
            onPlanoSelect={onPlanoSelect}
          />
        ))}
      </div>
    </div>
  );
};
