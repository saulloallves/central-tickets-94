import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { AlertTriangle } from "lucide-react";

interface PriorityData {
  prioridade: string;
  total: number;
  concluidos: number;
  taxa_resolucao: string;
}

export const PriorityAnalysisChart = ({ data }: { data: PriorityData[] }) => {
  const chartData = data.map(p => ({
    name: p.prioridade.charAt(0).toUpperCase() + p.prioridade.slice(1),
    Total: p.total,
    Concluídos: p.concluidos,
    'Em Aberto': p.total - p.concluidos,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Análise por Prioridade
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="Concluídos" fill="hsl(var(--chart-1))" />
              <Bar dataKey="Em Aberto" fill="hsl(var(--chart-2))" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};