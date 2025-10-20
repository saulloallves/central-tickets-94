import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, ChevronDown, ChevronRight, ExternalLink } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface UnitData {
  unidade: string;
  total_tickets: number;
  resolvidos: number;
  atrasados: number;
  taxa_resolucao: string;
  tickets_em_aberto: any[];
  total_abertos_atual: number;
}

interface UnitPerformanceTableProps {
  data: UnitData[];
  onTicketClick: (ticketCode: string) => void;
}

export const UnitPerformanceTable = ({ data, onTicketClick }: UnitPerformanceTableProps) => {
  const [expandedUnits, setExpandedUnits] = useState<Set<number>>(new Set());

  const toggleUnit = (index: number) => {
    const newExpanded = new Set(expandedUnits);
    if (newExpanded.has(index)) {
      newExpanded.delete(index);
    } else {
      newExpanded.add(index);
    }
    setExpandedUnits(newExpanded);
  };

  const getPriorityColor = (priority: string) => {
    const lowerPriority = priority.toLowerCase();
    if (lowerPriority === 'crise') return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400';
    if (lowerPriority === 'imediato') return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400';
    if (lowerPriority === 'alto') return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (lowerPriority === 'medio' || lowerPriority === 'média') return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400';
    return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Desempenho por Unidade
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.length > 0 ? (
            data.map((unit, index) => (
              <Collapsible
                key={index}
                open={expandedUnits.has(index)}
                onOpenChange={() => toggleUnit(index)}
              >
                <div className="border rounded-lg">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer">
                      <div className="flex items-center gap-3 flex-1">
                        {unit.total_abertos_atual > 0 ? (
                          expandedUnits.has(index) ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )
                        ) : (
                          <div className="w-4" />
                        )}
                        <span className="font-medium">{unit.unidade}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <div className="text-muted-foreground">Total</div>
                          <div className="font-semibold">{unit.total_tickets}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground">Resolvidos</div>
                          <div className="font-semibold text-green-600">{unit.resolvidos}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground">Abertos</div>
                          <Badge variant={unit.total_abertos_atual > 0 ? "default" : "secondary"}>
                            {unit.total_abertos_atual}
                          </Badge>
                        </div>
                        <div className="text-center">
                          <div className="text-muted-foreground">Taxa</div>
                          <div className="font-semibold">{unit.taxa_resolucao}</div>
                        </div>
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  {unit.total_abertos_atual > 0 && (
                    <CollapsibleContent>
                      <div className="border-t p-4 bg-muted/30">
                        <h4 className="text-sm font-medium mb-3">
                          Tickets em Aberto ({unit.total_abertos_atual})
                        </h4>
                        <div className="space-y-2">
                          {unit.tickets_em_aberto.map((ticket, ticketIndex) => (
                            <div
                              key={ticketIndex}
                              className="flex items-start gap-3 p-3 bg-background rounded-lg border hover:border-primary/50 transition-colors"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <Button
                                    variant="link"
                                    className="p-0 h-auto font-mono text-sm"
                                    onClick={() => onTicketClick(ticket.codigo_ticket)}
                                  >
                                    {ticket.codigo_ticket}
                                    <ExternalLink className="ml-1 h-3 w-3" />
                                  </Button>
                                  <Badge className={getPriorityColor(ticket.prioridade)}>
                                    {ticket.prioridade.toUpperCase()}
                                  </Badge>
                                  {ticket.status_sla === 'vencido' && (
                                    <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400">
                                      ATRASADO
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm font-medium truncate">
                                  {ticket.titulo || 'Sem título'}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {ticket.descricao_problema || 'Sem descrição'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </CollapsibleContent>
                  )}
                </div>
              </Collapsible>
            ))
          ) : (
            <div className="text-center text-muted-foreground py-8">
              Nenhuma unidade com tickets no período
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};