import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import { Clock } from "lucide-react";

interface SLAData {
  tickets_dentro_prazo: number;
  tickets_vencidos: number;
  tickets_proximos_vencer: number;
  percentual_sla: string;
}

export const SLAPerformanceChart = ({ data }: { data: SLAData }) => {
  const chartData = [
    { name: 'Dentro do Prazo', value: data.tickets_dentro_prazo, color: '#22c55e' },
    { name: 'Vencidos', value: data.tickets_vencidos, color: '#ef4444' },
    { name: 'Próximos de Vencer', value: data.tickets_proximos_vencer, color: '#f59e0b' },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Desempenho de SLA
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">Percentual Geral de SLA</p>
          <p className="text-3xl font-bold">{data.percentual_sla}</p>
        </div>
      </CardContent>
    </Card>
  );
};