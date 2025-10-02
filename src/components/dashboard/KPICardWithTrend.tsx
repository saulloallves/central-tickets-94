import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUp, ArrowDown, Minus, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardWithTrendProps {
  title: string;
  value: string | number;
  trend?: {
    value: number;
    label: string;
  };
  icon: LucideIcon;
  description?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger';
}

export function KPICardWithTrend({
  title,
  value,
  trend,
  icon: Icon,
  description,
  variant = 'default'
}: KPICardWithTrendProps) {
  
  const getTrendIcon = () => {
    if (!trend || trend.value === 0) return <Minus className="h-4 w-4" />;
    return trend.value > 0 
      ? <ArrowUp className="h-4 w-4" />
      : <ArrowDown className="h-4 w-4" />;
  };

  const getTrendColor = () => {
    if (!trend || trend.value === 0) return 'text-muted-foreground';
    
    // Para SLA e taxas de resolução, positivo é bom
    // Para tempo médio e tickets críticos, negativo é bom
    const isPositiveGood = title.includes('SLA') || title.includes('Resolv');
    const isGood = isPositiveGood ? trend.value > 0 : trend.value < 0;
    
    return isGood ? 'text-success' : 'text-destructive';
  };

  const getVariantStyles = () => {
    switch (variant) {
      case 'success':
        return 'border-success/20 bg-success/5';
      case 'warning':
        return 'border-warning/20 bg-warning/5';
      case 'danger':
        return 'border-destructive/20 bg-destructive/5';
      default:
        return '';
    }
  };

  return (
    <Card className={cn("transition-all hover:shadow-md", getVariantStyles())}>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        
        {trend && (
          <div className={cn("flex items-center gap-1 text-sm mt-1", getTrendColor())}>
            {getTrendIcon()}
            <span className="font-medium">
              {Math.abs(trend.value)}%
            </span>
            <span className="text-muted-foreground text-xs">
              {trend.label}
            </span>
          </div>
        )}

        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
