import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Calendar, User, CheckCircle2, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Acompanhamento } from '@/hooks/useAcompanhamento';
import { cn } from '@/lib/utils';

interface AcompanhamentoCardProps {
  acompanhamento: Acompanhamento;
  onClick: () => void;
  isSelected?: boolean;
}

export const AcompanhamentoCard = React.memo(function AcompanhamentoCard({
  acompanhamento,
  onClick,
  isSelected = false
}: AcompanhamentoCardProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    try {
      return format(new Date(dateString), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch {
      return dateString;
    }
  };

  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all hover:shadow-md border-l-4",
        isSelected ? "ring-2 ring-primary shadow-md" : "",
        "border-l-primary"
      )}
      onClick={onClick}
    >
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Building2 className="h-4 w-4 text-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">
                {acompanhamento.unidade?.fantasy_name?.trim() || 'Unidade ' + acompanhamento.codigo_grupo}
              </h4>
              <p className="text-xs text-muted-foreground">
                Código: {acompanhamento.codigo_grupo}
              </p>
            </div>
          </div>
        </div>

        {/* Localização */}
        {acompanhamento.unidade?.cidade && (
          <div className="text-xs text-muted-foreground">
            📍 {acompanhamento.unidade.cidade}, {acompanhamento.unidade.estado}
          </div>
        )}

        {/* Responsável */}
        {acompanhamento.responsavel_reuniao_nome && (
          <div className="flex items-center gap-2 text-xs">
            <User className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              {acompanhamento.responsavel_reuniao_nome}
            </span>
          </div>
        )}

        {/* Data da Reunião */}
        {acompanhamento.reuniao_inicial_data && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            <span className="text-muted-foreground">
              {formatDate(acompanhamento.reuniao_inicial_data)}
            </span>
          </div>
        )}

        {/* Status de Confirmação */}
        {acompanhamento.status === 'reuniao_agendada' && (
          <div className="flex items-center gap-2">
            {acompanhamento.reuniao_confirmada ? (
              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Confirmada
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                <Clock className="h-3 w-3 mr-1" />
                Aguardando confirmação
              </Badge>
            )}
          </div>
        )}

        {/* Próxima Reunião */}
        {acompanhamento.reuniao_proxima_data && (
          <div className="text-xs p-2 bg-primary/5 rounded-md">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>Próxima: {formatDate(acompanhamento.reuniao_proxima_data)}</span>
            </div>
          </div>
        )}

        {/* Data de Criação */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Criado em {formatDate(acompanhamento.created_at)}
        </div>
      </div>
    </Card>
  );
});
