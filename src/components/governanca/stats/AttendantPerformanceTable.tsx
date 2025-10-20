import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { UserCheck } from "lucide-react";

interface AttendantData {
  atendente: string;
  status_atendente: string;
  tickets_atendidos: number;
  concluidos: number;
  em_andamento: number;
  taxa_resolucao: string;
}

export const AttendantPerformanceTable = ({ data }: { data: AttendantData[] }) => {
  const getStatusBadge = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === 'ativo') return 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400';
    if (lowerStatus === 'pausa' || lowerStatus === 'almoco') return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400';
    return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400';
  };

  const getResolutionColor = (rate: string) => {
    const rateNum = parseFloat(rate.replace('%', ''));
    if (rateNum >= 80) return 'text-green-600 font-bold';
    if (rateNum >= 60) return 'text-yellow-600 font-bold';
    return 'text-red-600 font-bold';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          Performance de Atendentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Atendente</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Tickets Atendidos</TableHead>
                <TableHead className="text-center">Concluídos</TableHead>
                <TableHead className="text-center">Em Andamento</TableHead>
                <TableHead className="text-center">Taxa Resolução</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((attendant, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{attendant.atendente}</TableCell>
                  <TableCell>
                    <Badge className={getStatusBadge(attendant.status_atendente)}>
                      {attendant.status_atendente.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{attendant.tickets_atendidos}</TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400">
                      {attendant.concluidos}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{attendant.em_andamento}</TableCell>
                  <TableCell className={`text-center ${getResolutionColor(attendant.taxa_resolucao)}`}>
                    {attendant.taxa_resolucao}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Nenhum atendente com tickets no período
          </div>
        )}
      </CardContent>
    </Card>
  );
};