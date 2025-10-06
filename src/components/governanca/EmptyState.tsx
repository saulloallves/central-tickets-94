import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, BarChart3, Users, TrendingUp, FileText, Calendar, HelpCircle } from "lucide-react";

interface EmptyStateProps {
  type?: 'metrics' | 'chart' | 'data' | 'error' | 'no-tickets';
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  hint?: string;
}

export function EmptyState({ 
  type = 'data', 
  title, 
  description,
  icon,
  action,
  secondaryAction,
  hint
}: EmptyStateProps) {
  const getDefaultProps = () => {
    switch (type) {
      case 'no-tickets':
        return {
          title: title || 'Nenhum ticket encontrado',
          description: description || 'Não há tickets criados no período selecionado. As métricas serão exibidas assim que houver atividade.',
          icon: icon || <FileText className="h-10 w-10 text-muted-foreground" />,
          hint: hint || '💡 Dica: Ajuste o filtro de período ou crie tickets de teste para visualizar as métricas'
        };
      case 'metrics':
        return {
          title: title || 'Sem métricas disponíveis',
          description: description || 'Os dados de métricas serão calculados assim que houver tickets no sistema.',
          icon: icon || <BarChart3 className="h-10 w-10 text-muted-foreground" />,
          hint: hint || '📊 As métricas são calculadas com base nos tickets criados e suas resoluções'
        };
      case 'chart':
        return {
          title: title || 'Aguardando dados',
          description: description || 'O gráfico será exibido quando houver dados suficientes para análise.',
          icon: icon || <TrendingUp className="h-10 w-10 text-muted-foreground" />,
          hint: hint
        };
      case 'error':
        return {
          title: title || 'Erro ao carregar dados',
          description: description || 'Ocorreu um erro ao carregar as informações. Tente novamente em instantes.',
          icon: icon || <AlertCircle className="h-10 w-10 text-destructive" />,
          hint: hint
        };
      default:
        return {
          title: title || 'Nenhum dado disponível',
          description: description || 'Os dados solicitados não estão disponíveis no momento.',
          icon: icon || <Users className="h-10 w-10 text-muted-foreground" />,
          hint: hint
        };
    }
  };

  const { title: defaultTitle, description: defaultDescription, icon: defaultIcon, hint: defaultHint } = getDefaultProps();

  return (
    <Card className="liquid-glass-card">
      <CardContent className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="mb-6 opacity-80">
          {defaultIcon}
        </div>
        <h3 className="text-xl font-semibold text-foreground mb-3">
          {defaultTitle}
        </h3>
        <p className="text-sm text-muted-foreground max-w-lg mb-6 leading-relaxed">
          {defaultDescription}
        </p>
        
        {defaultHint && (
          <div className="bg-muted/50 rounded-lg px-4 py-3 mb-6 max-w-xl">
            <p className="text-xs text-muted-foreground leading-relaxed">
              {defaultHint}
            </p>
          </div>
        )}

        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-3 mt-2">
            {action && (
              <Button onClick={action.onClick} className="liquid-glass-button">
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button onClick={secondaryAction.onClick} variant="outline">
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}