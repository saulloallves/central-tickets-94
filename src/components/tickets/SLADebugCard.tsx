import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bug, AlertTriangle, CheckCircle, Clock, Calendar, Pause } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import {
  getExpectedSLAMinutes,
  calculateSLADiscrepancy,
  calculateElapsedTime,
  formatMinutes,
  detectSLAIssues,
  explainBusinessHoursSLA,
} from '@/lib/sla-debug-utils';
import { getPriorityLabel, type TicketPriority } from '@/lib/priority-utils';
import { formatDateTimeBR } from '@/lib/date-utils';

interface SLADebugCardProps {
  ticket: {
    prioridade: string;
    sla_minutos_totais?: number;
    sla_minutos_restantes?: number;
    data_abertura?: string;
    data_limite_sla?: string;
    tempo_pausado_total?: string;
    sla_pausado_horario?: boolean;
    sla_vencido?: boolean;
  };
}

export const SLADebugCard = ({ ticket }: SLADebugCardProps) => {
  const [isOpen, setIsOpen] = useState(false);

  const expectedSLA = getExpectedSLAMinutes(ticket.prioridade);
  const discrepancy = ticket.sla_minutos_totais
    ? calculateSLADiscrepancy(ticket.prioridade, ticket.sla_minutos_totais)
    : null;
  const issues = detectSLAIssues(ticket);

  const elapsedTime = ticket.data_abertura && ticket.data_limite_sla
    ? calculateElapsedTime(ticket.data_abertura, ticket.data_limite_sla)
    : null;

  const businessHoursExplanation = ticket.data_abertura && ticket.data_limite_sla && ticket.sla_minutos_totais
    ? explainBusinessHoursSLA(ticket.data_abertura, ticket.data_limite_sla, ticket.sla_minutos_totais)
    : null;

  // Parse tempo pausado (formato: "HH:MM:SS" ou null)
  const tempoPausadoMinutos = ticket.tempo_pausado_total
    ? (() => {
        const parts = ticket.tempo_pausado_total.split(':');
        const hours = parseInt(parts[0] || '0', 10);
        const minutes = parseInt(parts[1] || '0', 10);
        return hours * 60 + minutes;
      })()
    : 0;

  const getSeverityBadge = () => {
    switch (issues.severity) {
      case 'error':
        return <Badge variant="destructive">Crítico</Badge>;
      case 'warning':
        return <Badge variant="warning">Atenção</Badge>;
      case 'none':
        return <Badge variant="success">OK</Badge>;
    }
  };

  const getSeverityIcon = () => {
    switch (issues.severity) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case 'none':
        return <CheckCircle className="h-4 w-4 text-success" />;
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50">
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
              <CardTitle className="text-base flex items-center gap-2">
                <Bug className="h-4 w-4" />
                Debug: Cálculo de SLA
                {getSeverityBadge()}
              </CardTitle>
              <div className="flex items-center gap-2">
                {issues.hasIssue && getSeverityIcon()}
                <span className="text-xs text-muted-foreground">
                  {isOpen ? 'Recolher' : 'Expandir'}
                </span>
              </div>
            </Button>
          </CollapsibleTrigger>
        </CardHeader>
        
        <CollapsibleContent>
          <CardContent className="space-y-4 text-sm">
            {/* Configuração */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Clock className="h-3 w-3" />
                Configuração
              </div>
              <div className="pl-5 space-y-1.5">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Prioridade:</span>
                  <Badge variant="outline">{getPriorityLabel(ticket.prioridade as TicketPriority)}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">SLA Esperado:</span>
                  <span className="font-medium">{formatMinutes(expectedSLA)}</span>
                </div>
                {ticket.sla_minutos_totais && (
                  <>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">SLA Configurado:</span>
                      <span className="font-medium flex items-center gap-1">
                        {formatMinutes(ticket.sla_minutos_totais)}
                        {discrepancy?.hasDiscrepancy && (
                          <Badge variant={discrepancy.isLower ? "destructive" : "warning"} className="ml-1">
                            {discrepancy.isLower ? '-' : '+'}{Math.abs(discrepancy.difference)} min
                          </Badge>
                        )}
                      </span>
                    </div>
                    {discrepancy?.hasDiscrepancy && (
                      <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border/50">
                        ⚠️ O SLA configurado está {discrepancy.isLower ? 'menor' : 'maior'} que o esperado para esta prioridade
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Período */}
            {ticket.data_abertura && ticket.data_limite_sla && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <Calendar className="h-3 w-3" />
                  Período
                </div>
                <div className="pl-5 space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Abertura:</span>
                    <span className="font-medium">{formatDateTimeBR(ticket.data_abertura)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Limite SLA:</span>
                    <span className="font-medium">{formatDateTimeBR(ticket.data_limite_sla)}</span>
                  </div>
                  {elapsedTime && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tempo Corrido:</span>
                      <span className="font-medium">{elapsedTime.formatted}</span>
                    </div>
                  )}
                  {ticket.sla_minutos_totais && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Tempo em Expediente:</span>
                      <span className="font-medium text-success">{formatMinutes(ticket.sla_minutos_totais)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status Atual */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Pause className="h-3 w-3" />
                Status Atual
              </div>
              <div className="pl-5 space-y-1.5">
                {ticket.sla_minutos_restantes !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Minutos Restantes:</span>
                    <span className={`font-medium ${ticket.sla_vencido ? 'text-destructive' : 'text-foreground'}`}>
                      {formatMinutes(Math.max(0, ticket.sla_minutos_restantes))}
                    </span>
                  </div>
                )}
                {tempoPausadoMinutos > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tempo Pausado:</span>
                    <span className="font-medium">{formatMinutes(tempoPausadoMinutos)}</span>
                  </div>
                )}
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Pausado (Fora do Expediente):</span>
                  <Badge variant={ticket.sla_pausado_horario ? "outline" : "secondary"}>
                    {ticket.sla_pausado_horario ? '✅ Sim' : '❌ Não'}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Explicação do Cálculo */}
            {businessHoursExplanation && elapsedTime && elapsedTime.totalMinutes > (ticket.sla_minutos_totais || 0) && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  💡 Por que o tempo corrido é maior?
                </div>
                <div className="text-xs leading-relaxed bg-primary/5 p-3 rounded border border-primary/20">
                  {businessHoursExplanation.explicacao}
                </div>
              </div>
            )}

            {/* Issues Detectados */}
            {issues.hasIssue && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <AlertTriangle className="h-3 w-3" />
                  Problemas Detectados
                </div>
                <div className="pl-5 space-y-1">
                  {issues.issues.map((issue, idx) => (
                    <div key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                      <span className={issues.severity === 'error' ? 'text-destructive' : 'text-warning'}>•</span>
                      <span>{issue}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
