import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface KPICardProps {
  title: string;
  value: string | number;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'critical';
  icon?: React.ReactNode;
  iconColor?: string;
  loading?: boolean;
}

export const KPICard = ({ 
  title, 
  value, 
  description, 
  trend, 
  trendValue,
  color = 'default',
  icon,
  iconColor,
  loading = false
}: KPICardProps) => {
  const getColorClasses = () => {
    switch (color) {
      case 'success':
        return 'border-success/20 bg-success/5 text-success-foreground';
      case 'warning':
        return 'border-warning/20 bg-warning/5 text-warning-foreground';
      case 'danger':
      case 'critical':
        return 'border-critical/20 bg-critical/5 text-critical-foreground';
      case 'info':
        return 'border-info/20 bg-info/5 text-info-foreground';
      default:
        return 'border-border bg-card text-card-foreground';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      case 'neutral':
        return <Minus className="h-4 w-4 text-muted-foreground" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <Card className="animate-pulse">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 bg-muted rounded w-24"></div>
          <div className="h-4 w-4 bg-muted rounded"></div>
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-muted rounded w-16 mb-2"></div>
          <div className="h-3 bg-muted rounded w-20"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`transition-all hover:shadow-md ${getColorClasses()}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon && (
          <div className={iconColor || "text-muted-foreground"}>
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="flex items-center space-x-2">
          <div className="text-2xl font-bold">{value}</div>
          {trend && trendValue && (
            <div className="flex items-center space-x-1">
              {getTrendIcon()}
              <span className="text-xs text-muted-foreground">{trendValue}</span>
            </div>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
};