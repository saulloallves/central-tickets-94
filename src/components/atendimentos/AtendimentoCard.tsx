import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, RotateCcw, FileText, Clock, MessageSquare, Bot, Phone } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AtendimentoCardProps {
  atendimento: any;
  onClick: () => void;
  compact?: boolean;
}

const STATUS_CONFIG = {
  novo: { variant: 'info' as const, emoji: '🔵' },
  em_fila: { variant: 'warning' as const, emoji: '🟡' },
  em_atendimento: { variant: 'info' as const, emoji: '🔵' },
  concluido: { variant: 'success' as const, emoji: '🟢' },
  emergencia: { variant: 'critical' as const, emoji: '🔴' },
};

export function AtendimentoCard({ atendimento, onClick, compact = false }: AtendimentoCardProps) {
  const statusConfig = STATUS_CONFIG[atendimento.status] || STATUS_CONFIG.novo;
  
  const formatTempo = (tempo: number) => {
    if (tempo < 60) return `${tempo}m`;
    const horas = Math.floor(tempo / 60);
    const minutos = tempo % 60;
    return `${horas}h ${minutos}m`;
  };

  const getUltimaInteracaoIcon = (tipo: string) => {
    switch (tipo) {
      case 'mensagem':
        return <MessageSquare className="w-3 h-3" />;
      case 'automatica':
        return <Bot className="w-3 h-3" />;
      default:
        return <MessageSquare className="w-3 h-3" />;
    }
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1",
        compact ? "p-3" : "p-4",
        "h-fit min-h-[120px] flex flex-col"
      )}
      onClick={onClick}
    >
      <CardContent className={cn("flex flex-col justify-between h-full", compact ? "p-0" : "p-0")}>
        <div className="space-y-3 flex-1">
          {/* Header com status e tempo */}
          <div className="flex items-center justify-between">
            <Badge variant={statusConfig.variant} className="text-xs">
              {statusConfig.emoji} {atendimento.status.replace('_', ' ')}
            </Badge>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              {formatTempo(atendimento.tempoEspera)}
            </div>
          </div>

          {/* Informações principais */}
          <div className="space-y-2 flex-1">
            <div className="font-medium text-sm truncate">
              {atendimento.unidade}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>{atendimento.telefone}</span>
            </div>
          </div>

          {/* Última interação */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {getUltimaInteracaoIcon(atendimento.ultimaInteracao.tipo)}
            <span className="truncate flex-1">{atendimento.ultimaInteracao.texto}</span>
            <span>{atendimento.ultimaInteracao.tempo}</span>
          </div>
        </div>

        {/* Ações rápidas - apenas em cards não compactos */}
        {!compact && (
          <div className="flex gap-2 pt-3 mt-auto">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implementar ação concluir
              }}
            >
              <CheckCircle className="w-3 h-3 mr-1" />
              Concluir
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implementar ação transferir
              }}
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              Transferir
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implementar ver histórico
              }}
            >
              <FileText className="w-3 h-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}