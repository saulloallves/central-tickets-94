import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, BarChart3, Users, TrendingUp } from "lucide-react";

interface EmptyStateProps {
  type?: 'metrics' | 'chart' | 'data' | 'error';
  title?: string;
  description?: string;
  icon?: React.ReactNode;
}

export function EmptyState({ 
  type = 'data', 
  title, 
  description,
  icon 
}: EmptyStateProps) {
  const getDefaultProps = () => {
    switch (type) {
      case 'metrics':
        return {
          title: title || 'Sem métricas',
          description: description || 'Dados de métricas não estão disponíveis no momento',
          icon: icon || <BarChart3 className="h-8 w-8 text-muted-foreground" />
        };
      case 'chart':
        return {
          title: title || 'Sem dados para gráfico',
          description: description || 'Não há dados suficientes para exibir o gráfico',
          icon: icon || <TrendingUp className="h-8 w-8 text-muted-foreground" />
        };
      case 'error':
        return {
          title: title || 'Erro ao carregar dados',
          description: description || 'Ocorreu um erro ao carregar as informações. Tente novamente.',
          icon: icon || <AlertCircle className="h-8 w-8 text-destructive" />
        };
      default:
        return {
          title: title || 'Sem dados',
          description: description || 'Nenhum dado encontrado para exibir',
          icon: icon || <Users className="h-8 w-8 text-muted-foreground" />
        };
    }
  };

  const { title: defaultTitle, description: defaultDescription, icon: defaultIcon } = getDefaultProps();

  return (
    <Card className="liquid-glass-card">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4">
          {defaultIcon}
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {defaultTitle}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md">
          {defaultDescription}
        </p>
      </CardContent>
    </Card>
  );
}