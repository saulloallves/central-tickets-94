import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";

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
    const lowerPriority = priority.toLowerCase();
    if (lowerPriority === 'crise') return 'destructive';
    if (lowerPriority === 'imediato' || lowerPriority === 'alto') return 'destructive';
    if (lowerPriority === 'medio' || lowerPriority === 'média') return 'default';
    return 'secondary';
  };

  const getPriorityColor = (priority: string) => {
    const lowerPriority = priority.toLowerCase();
    if (lowerPriority === 'crise') return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400';
    if (lowerPriority === 'imediato') return 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400';
    if (lowerPriority === 'alto') return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400';
    if (lowerPriority === 'medio' || lowerPriority === 'média') return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400';
    return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900/30 dark:text-slate-400';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-red-500" />
          Tickets Vencidos ({data.length})
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
                    <Badge className={getPriorityColor(ticket.prioridade)}>
                      {ticket.prioridade.toUpperCase()}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge className="bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400">
                      {ticket.horas_atrasadas}h
                    </Badge>
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
            Nenhum ticket vencido no período
          </div>
        )}
      </CardContent>
    </Card>
  );
};