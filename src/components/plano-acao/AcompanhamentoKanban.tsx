import React, { useMemo } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Building2, Calendar, Clock, CheckCircle2, FileCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Acompanhamento } from '@/hooks/useAcompanhamento';
import { AcompanhamentoCard } from './AcompanhamentoCard';
import { cn } from '@/lib/utils';

interface AcompanhamentoKanbanProps {
  acompanhamentos: Acompanhamento[];
  onAcompanhamentoSelect: (acompanhamento: Acompanhamento) => void;
  selectedAcompanhamentoId: string | null;
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
    id: 'em_acompanhamento',
    title: 'Em Acompanhamento',
    icon: Building2,
    color: 'bg-slate-50 border-slate-200',
    iconColor: 'text-slate-600'
  },
  {
    id: 'reuniao_agendada',
    title: 'Reunião Agendada',
    icon: Calendar,
    color: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-600'
  },
  {
    id: 'proximas_reunioes',
    title: 'Próximas Reuniões',
    icon: Clock,
    color: 'bg-purple-50 border-purple-200',
    iconColor: 'text-purple-600'
  },
  {
    id: 'reunioes_dia',
    title: 'Reuniões do Dia',
    icon: CheckCircle2,
    color: 'bg-orange-50 border-orange-200',
    iconColor: 'text-orange-600'
  },
  {
    id: 'plano_criado',
    title: 'Plano Criado',
    icon: FileCheck,
    color: 'bg-green-50 border-green-200',
    iconColor: 'text-green-600'
  }
];

interface KanbanColumnProps {
  config: ColumnConfig;
  acompanhamentos: Acompanhamento[];
  selectedId: string | null;
  onSelect: (acompanhamento: Acompanhamento) => void;
}

const KanbanColumn: React.FC<KanbanColumnProps> = ({
  config,
  acompanhamentos,
  selectedId,
  onSelect
}) => {
  const Icon = config.icon;

  return (
    <div className="flex flex-col h-full min-w-[280px] w-full">
      {/* Column Header */}
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
            {acompanhamentos.length}
          </div>
        </div>
      </div>

      {/* Column Content */}
      <ScrollArea className="flex-1 bg-muted/30 rounded-b-lg">
        <div className="p-3 space-y-3 min-h-[500px]">
          {acompanhamentos.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
              Nenhuma unidade
            </div>
          ) : (
            acompanhamentos.map((acomp) => (
              <AcompanhamentoCard
                key={acomp.id}
                acompanhamento={acomp}
                onClick={() => onSelect(acomp)}
                isSelected={acomp.id === selectedId}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export const AcompanhamentoKanban: React.FC<AcompanhamentoKanbanProps> = ({
  acompanhamentos,
  onAcompanhamentoSelect,
  selectedAcompanhamentoId
}) => {
  const groupedAcompanhamentos = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return {
      em_acompanhamento: acompanhamentos.filter(a => a.status === 'em_acompanhamento'),
      reuniao_agendada: acompanhamentos.filter(a => a.status === 'reuniao_agendada'),
      proximas_reunioes: acompanhamentos.filter(a => {
        if (a.status !== 'reuniao_agendada' || !a.reuniao_inicial_data) return false;
        const reuniaoDate = new Date(a.reuniao_inicial_data);
        return reuniaoDate >= tomorrow;
      }),
      reunioes_dia: acompanhamentos.filter(a => {
        if (!a.reuniao_inicial_data) return false;
        const reuniaoDate = new Date(a.reuniao_inicial_data);
        reuniaoDate.setHours(0, 0, 0, 0);
        return reuniaoDate.getTime() === today.getTime();
      }),
      plano_criado: acompanhamentos.filter(a => a.status === 'plano_criado')
    };
  }, [acompanhamentos]);

  return (
    <div className="flex-1 overflow-hidden">
      <div className="flex gap-4 h-full overflow-x-auto pb-4">
        {COLUMNS.map((column) => (
          <KanbanColumn
            key={column.id}
            config={column}
            acompanhamentos={groupedAcompanhamentos[column.id as keyof typeof groupedAcompanhamentos]}
            selectedId={selectedAcompanhamentoId}
            onSelect={onAcompanhamentoSelect}
          />
        ))}
      </div>
    </div>
  );
};
