import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

interface TeamData {
  equipe: string;
  total_tickets: number;
  resolvidos: number;
  em_andamento: number;
  atrasados: number;
  taxa_resolucao: string;
  sla_ok: number;
}

export const TeamPerformanceTable = ({ data }: { data: TeamData[] }) => {
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
          <Users className="h-5 w-5" />
          Desempenho por Equipe
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Equipe</TableHead>
              <TableHead className="text-center">Total</TableHead>
              <TableHead className="text-center">Resolvidos</TableHead>
              <TableHead className="text-center">Em Andamento</TableHead>
              <TableHead className="text-center">Atrasados</TableHead>
              <TableHead className="text-center">Taxa Resolução</TableHead>
              <TableHead className="text-center">SLA OK</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length > 0 ? (
              data.map((team, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{team.equipe}</TableCell>
                  <TableCell className="text-center">{team.total_tickets}</TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400">
                      {team.resolvidos}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{team.em_andamento}</TableCell>
                  <TableCell className="text-center">
                    {team.atrasados > 0 ? (
                      <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400">
                        {team.atrasados}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className={`text-center ${getResolutionColor(team.taxa_resolucao)}`}>
                    {team.taxa_resolucao}
                  </TableCell>
                  <TableCell className="text-center">{team.sla_ok}</TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhuma equipe com tickets no período
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};