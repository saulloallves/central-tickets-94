import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

interface EscalationsData {
  total: number;
  por_nivel: Record<string, number>;
  total_eventos?: number;
}

export const EscalationsCard = ({ data }: { data: EscalationsData }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Escalações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Tickets Escalados</p>
              <p className="text-3xl font-bold">{data.total}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-1">Total de Eventos</p>
              <p className="text-3xl font-bold">{data.total_eventos || 0}</p>
            </div>
          </div>

          {Object.keys(data.por_nivel || {}).length > 0 && (
            <div>
              <p className="text-sm font-medium mb-3">Distribuição por Nível Máximo</p>
              <div className="space-y-2">
                {Object.entries(data.por_nivel || {}).map(([nivel, count]) => (
                  <div key={nivel} className="flex items-center justify-between">
                    <span className="text-sm">{nivel.replace('nivel_', 'Nível ')}</span>
                    <Badge variant="secondary">{count}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.total === 0 && (
            <div className="text-center text-muted-foreground py-4">
              Nenhum ticket foi escalado no período
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};