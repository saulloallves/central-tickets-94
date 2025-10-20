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
              <defs>
                <linearGradient id="colorTickets" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#93c5fd" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
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
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#colorTickets)"
                name="Tickets Abertos"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};