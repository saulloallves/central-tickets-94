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
    const variants: any = {
      ativo: 'default',
      pausa: 'secondary',
      almoco: 'secondary',
      indisponivel: 'secondary',
      inativo: 'secondary',
    };
    return variants[status] || 'secondary';
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
                    <Badge variant={getStatusBadge(attendant.status_atendente)}>
                      {attendant.status_atendente}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">{attendant.tickets_atendidos}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="default">{attendant.concluidos}</Badge>
                  </TableCell>
                  <TableCell className="text-center">{attendant.em_andamento}</TableCell>
                  <TableCell className="text-center font-semibold">
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