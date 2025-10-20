import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { MessageSquare } from "lucide-react";

interface ChannelData {
  canal: string;
  total: number;
  percentual: string;
}

const CHANNEL_COLORS: Record<string, string> = {
  'WHATSAPP': '#25D366',
  'WEB': '#3b82f6',
  'EMAIL': '#8b5cf6',
  'TELEFONE': '#f97316',
  'CHAT': '#06b6d4',
  'BOT': '#14b8a6',
  'TYPEBOT': '#14b8a6',
  'PORTAL': '#3b82f6',
};

const FALLBACK_COLORS = [
  '#3b82f6',
  '#8b5cf6',
  '#06b6d4',
  '#f97316',
  '#eab308',
];

export const ChannelAnalysisChart = ({ data }: { data: ChannelData[] }) => {
  const chartData = data.map(c => ({
    name: c.canal.replace('_', ' ').toUpperCase(),
    Tickets: c.total,
    percentual: c.percentual,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Análise por Canal de Origem
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="Tickets" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index) => {
                  const color = CHANNEL_COLORS[entry.name] || FALLBACK_COLORS[index % FALLBACK_COLORS.length];
                  return <Cell key={`cell-${index}`} fill={color} />;
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};