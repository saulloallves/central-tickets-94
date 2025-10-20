import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ExternalLink } from "lucide-react";

interface CrisisTicket {
  codigo: string;
  descricao: string;
  data_abertura: string;
  tempo_decorrido_horas: number;
  status: string;
  equipe: string;
  unidade: string;
}

interface CrisisTicketsCardProps {
  data: CrisisTicket[];
  onTicketClick: (ticketCode: string) => void;
}

export const CrisisTicketsCard = ({ data, onTicketClick }: CrisisTicketsCardProps) => {
  return (
    <Card className={data.length > 0 ? "border-destructive/50 bg-destructive/5" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          Tickets em Crise ({data.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <div className="space-y-3">
            {data.map((ticket, index) => (
              <div
                key={index}
                className="p-3 bg-background border border-destructive/30 rounded-lg hover:border-destructive/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Button
                        variant="link"
                        className="p-0 h-auto font-mono text-sm"
                        onClick={() => onTicketClick(ticket.codigo)}
                      >
                        {ticket.codigo}
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </Button>
                      <Badge variant="destructive">CRISE</Badge>
                    </div>
                    <p className="text-sm mb-2 line-clamp-2">{ticket.descricao}</p>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>Unidade: {ticket.unidade}</span>
                      <span>•</span>
                      <span>Equipe: {ticket.equipe}</span>
                      <span>•</span>
                      <span className="font-semibold text-destructive">
                        Há {ticket.tempo_decorrido_horas}h
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-8">
            Nenhum ticket em crise no período
          </div>
        )}
      </CardContent>
    </Card>
  );
};