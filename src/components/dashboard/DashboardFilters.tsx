import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export type PeriodoType = 'hoje' | 'semana' | 'mes' | '90dias' | 'customizado';
export type VisaoType = 'geral' | 'equipe' | 'unidade';

export interface DashboardFiltersState {
  periodo: PeriodoType;
  dataInicio?: Date;
  dataFim?: Date;
  visao: VisaoType;
  equipe_id?: string;
  unidade_id?: string;
}

interface DashboardFiltersProps {
  filters: DashboardFiltersState;
  onChange: (filters: DashboardFiltersState) => void;
  equipes?: Array<{ id: string; nome: string }>;
  unidades?: Array<{ id: string; nome: string }>;
  allowedViews?: VisaoType[];
  userRole?: 'admin' | 'diretoria' | 'colaborador' | 'gerente';
}

export function DashboardFilters({
  filters,
  onChange,
  equipes = [],
  unidades = [],
  allowedViews = ['geral', 'equipe', 'unidade'],
  userRole = 'colaborador'
}: DashboardFiltersProps) {
  
  const handlePeriodoChange = (periodo: PeriodoType) => {
    const today = new Date();
    let dataInicio: Date | undefined;
    let dataFim: Date | undefined;

    switch (periodo) {
      case 'hoje':
        dataInicio = today;
        dataFim = today;
        break;
      case 'semana':
        dataInicio = new Date(today.setDate(today.getDate() - 7));
        dataFim = new Date();
        break;
      case 'mes':
        dataInicio = new Date(today.setDate(today.getDate() - 30));
        dataFim = new Date();
        break;
      case '90dias':
        dataInicio = new Date(today.setDate(today.getDate() - 90));
        dataFim = new Date();
        break;
      case 'customizado':
        // Mantém datas customizadas existentes
        dataInicio = filters.dataInicio;
        dataFim = filters.dataFim;
        break;
    }

    onChange({ ...filters, periodo, dataInicio, dataFim });
  };

  const handleVisaoChange = (visao: VisaoType) => {
    onChange({ 
      ...filters, 
      visao,
      // Reset filtros secundários ao mudar visão
      equipe_id: visao === 'equipe' ? filters.equipe_id : undefined,
      unidade_id: visao === 'unidade' ? filters.unidade_id : undefined
    });
  };

  const periodos: Array<{ value: PeriodoType; label: string }> = [
    { value: 'hoje', label: 'Hoje' },
    { value: 'semana', label: 'Últimos 7 dias' },
    { value: 'mes', label: 'Últimos 30 dias' },
    { value: '90dias', label: 'Últimos 90 dias' },
    { value: 'customizado', label: 'Personalizado' },
  ];

  const allVisoes: Array<{ value: VisaoType; label: string }> = [
    { value: 'geral' as VisaoType, label: 'Visão Geral' },
    { value: 'equipe' as VisaoType, label: 'Por Equipe' },
    { value: 'unidade' as VisaoType, label: 'Por Unidade' },
  ];
  const visoes = allVisoes.filter(v => allowedViews.includes(v.value));

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Período */}
          <div className="space-y-2">
            <Label>📅 Período</Label>
            <Select value={filters.periodo} onValueChange={handlePeriodoChange}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {periodos.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Datas customizadas */}
          {filters.periodo === 'customizado' && (
            <>
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dataInicio && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dataInicio ? format(filters.dataInicio, "PPP", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dataInicio}
                      onSelect={(date) => onChange({ ...filters, dataInicio: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.dataFim && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dataFim ? format(filters.dataFim, "PPP", { locale: ptBR }) : "Selecione"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dataFim}
                      onSelect={(date) => onChange({ ...filters, dataFim: date })}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </>
          )}

          {/* Visão */}
          <div className="space-y-2">
            <Label>👁️ Visão</Label>
            <Select value={filters.visao} onValueChange={(value: string) => handleVisaoChange(value as VisaoType)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a visão" />
              </SelectTrigger>
              <SelectContent>
                {visoes.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filtro secundário - Equipe */}
          {filters.visao === 'equipe' && equipes.length > 0 && (
            <div className="space-y-2">
              <Label>Equipe</Label>
              <Select 
                value={filters.equipe_id} 
                onValueChange={(value) => onChange({ ...filters, equipe_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a equipe" />
                </SelectTrigger>
                <SelectContent>
                  {equipes.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filtro secundário - Unidade */}
          {filters.visao === 'unidade' && unidades.length > 0 && (
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select 
                value={filters.unidade_id} 
                onValueChange={(value) => onChange({ ...filters, unidade_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a unidade" />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((unidade) => (
                    <SelectItem key={unidade.id} value={unidade.id}>
                      {unidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
