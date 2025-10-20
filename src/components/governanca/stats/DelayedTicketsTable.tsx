import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle, ExternalLink } from "lucide-react";

interface DelayedTicket {
  codigo: string;
  titulo: string;
  descricao_problema: string;
  prioridade: string;
  data_abertura: string;
  data_limite_sla: string;
  horas_atrasadas: number;
  equipe: string;
  responsavel: string;
  status: string;
}

interface DelayedTicketsTableProps {
  data: DelayedTicket[];
  onTicketClick: (ticketCode: string) => void;
}

export const DelayedTicketsTable = ({ data, onTicketClick }: DelayedTicketsTableProps) => {
  const getPriorityBadge = (priority: string) => {
    const variants: any = {
      crise: 'destructive',
      imediato: 'destructive',
      alto: 'destructive',
      medio: 'default',
      baixo: 'secondary',
    };
    return variants[priority] || 'default';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-destructive" />
          Tickets Atrasados ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Código</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead className="text-center">Horas Atrasadas</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((ticket, index) => (
                <TableRow key={index}>
                  <TableCell className="font-mono text-sm">{ticket.codigo}</TableCell>
                  <TableCell className="max-w-xs truncate">{ticket.titulo}</TableCell>
                  <TableCell>
                    <Badge variant={getPriorityBadge(ticket.prioridade)}>
                      {ticket.prioridade}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="destructive">{ticket.horas_atrasadas}h</Badge>
                  </TableCell>
                  <TableCell>{ticket.equipe}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ticket.status}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onTicketClick(ticket.codigo)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Nenhum ticket atrasado no período
          </div>
        )}
      </CardContent>
    </Card>
  );
};