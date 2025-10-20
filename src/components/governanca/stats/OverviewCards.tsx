import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, CheckCircle2, Clock } from "lucide-react";

interface OverviewData {
  total_abertos: number;
  total_concluidos: number;
  total_em_andamento: number;
  taxa_conclusao: string;
}

export const OverviewCards = ({ data }: { data: OverviewData }) => {
  const taxaNum = parseFloat(data.taxa_conclusao.replace('%', ''));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Abertos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{data.total_abertos}</div>
          <p className="text-xs text-muted-foreground mt-1">
            No período selecionado
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Concluídos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <div className="text-2xl font-bold text-green-600">
              {data.total_concluidos}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Taxa: {data.taxa_conclusao}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Em Andamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            <div className="text-2xl font-bold text-amber-600">
              {data.total_em_andamento}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Aguardando conclusão
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Taxa de Conclusão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            {taxaNum >= 70 ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            <div className={`text-2xl font-bold ${taxaNum >= 70 ? 'text-green-600' : 'text-red-600'}`}>
              {data.taxa_conclusao}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {taxaNum >= 70 ? 'Acima da meta' : 'Abaixo da meta'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
};