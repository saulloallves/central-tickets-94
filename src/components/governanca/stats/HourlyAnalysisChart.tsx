import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Clock } from "lucide-react";

interface HourlyData {
  hora: string;
  tickets_abertos: number;
}

export const HourlyAnalysisChart = ({ data }: { data: HourlyData[] }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Análise Horária de Abertura de Tickets
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="hora" 
                tick={{ fontSize: 12 }}
                interval={2}
              />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="tickets_abertos" 
                stroke="hsl(var(--chart-1))" 
                fill="hsl(var(--chart-1))" 
                fillOpacity={0.6}
                name="Tickets Abertos"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};