import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, RotateCcw, FileText, Clock, MessageSquare, Bot, Phone, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface AtendimentoCardProps {
  atendimento: {
    id: string;
    unidade_id: string;
    franqueado_nome: string;
    telefone: string;
    descricao: string;
    categoria?: string;
    prioridade: string;
    status: string;
    tipo_atendimento: string;
    atendente_id?: string;
    atendente_nome?: string;
    resolucao?: string;
    criado_em: string;
    atualizado_em?: string;
  };
  onClick: () => void;
  compact?: boolean;
}

const STATUS_CONFIG = {
  em_fila: { variant: 'warning' as const, emoji: '🟡', label: 'Em Fila' },
  em_atendimento: { variant: 'info' as const, emoji: '🔵', label: 'Em Atendimento' },
  finalizado: { variant: 'success' as const, emoji: '🟢', label: 'Finalizado' },
};

const PRIORIDADE_CONFIG = {
  normal: { variant: 'secondary' as const, label: 'Normal' },
  alta: { variant: 'destructive' as const, label: 'Alta' },
  urgente: { variant: 'destructive' as const, label: 'Urgente' },
};

export function AtendimentoCard({ atendimento, onClick, compact = false }: AtendimentoCardProps) {
  const statusConfig = STATUS_CONFIG[atendimento.status] || STATUS_CONFIG.em_fila;
  const prioridadeConfig = PRIORIDADE_CONFIG[atendimento.prioridade] || PRIORIDADE_CONFIG.normal;
  
  const formatTempo = (data: string) => {
    try {
      const dataObj = new Date(data);
      return formatDistanceToNow(dataObj, { 
        addSuffix: true, 
        locale: ptBR 
      });
    } catch {
      return 'há alguns instantes';
    }
  };

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-all duration-200 hover:-translate-y-1",
        compact ? "p-3" : "p-4",
        "h-fit min-h-[140px] flex flex-col"
      )}
      onClick={onClick}
    >
      <CardContent className={cn("flex flex-col justify-between h-full", compact ? "p-0" : "p-0")}>
        <div className="space-y-3 flex-1">
          {/* Header com status e prioridade */}
          <div className="flex items-center justify-between">
            <Badge variant={statusConfig.variant} className="text-xs">
              {statusConfig.emoji} {statusConfig.label}
            </Badge>
            <Badge variant={prioridadeConfig.variant} className="text-xs">
              {prioridadeConfig.label}
            </Badge>
          </div>

          {/* Informações principais */}
          <div className="space-y-2 flex-1">
            <div className="font-medium text-sm truncate">
              {atendimento.unidade_id} - {atendimento.franqueado_nome}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="w-3 h-3" />
              <span>{atendimento.telefone}</span>
            </div>
            <div className="text-xs text-muted-foreground line-clamp-2">
              {atendimento.descricao}
            </div>
          </div>

          {/* Informações de atendimento */}
          <div className="space-y-1">
            {atendimento.atendente_nome && (
              <div className="flex items-center gap-2 text-xs text-primary font-medium">
                <User className="w-3 h-3" />
                <span>Responsável: {atendimento.atendente_nome}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>Criado {formatTempo(atendimento.criado_em)}</span>
            </div>
            {atendimento.categoria && (
              <div className="text-xs text-muted-foreground">
                Categoria: {atendimento.categoria}
              </div>
            )}
          </div>
        </div>

        {/* Ações rápidas - apenas em cards não compactos */}
        {!compact && atendimento.status !== 'finalizado' && (
          <div className="flex gap-2 pt-3 mt-auto">
            {atendimento.status === 'em_fila' && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implementar ação iniciar atendimento
                }}
              >
                <MessageSquare className="w-3 h-3 mr-1" />
                Iniciar
              </Button>
            )}
            {atendimento.status === 'em_atendimento' && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  // TODO: Implementar ação finalizar
                }}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Finalizar
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              className="h-8 px-2"
              onClick={(e) => {
                e.stopPropagation();
                // TODO: Implementar ver detalhes
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