import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, ExternalLink, Clock, AlertCircle, Building2, Users } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

interface TicketDetailModalProps {
  ticketCode: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TicketDetailModal = ({ ticketCode, open, onOpenChange }: TicketDetailModalProps) => {
  const [loading, setLoading] = useState(false);
  const [ticket, setTicket] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (open && ticketCode) {
      loadTicketDetails();
    }
  }, [open, ticketCode]);

  const loadTicketDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          unidades(grupo),
          equipes(nome),
          profiles:criado_por(nome),
          ticket_mensagens(
            id,
            mensagem,
            direcao,
            created_at,
            profiles:usuario_id(nome)
          )
        `)
        .eq('codigo_ticket', ticketCode)
        .single();

      if (error) throw error;

      console.log('Ticket detalhado:', data);
      setTicket(data);
    } catch (error) {
      console.error('Erro ao carregar ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    const colors: any = {
      crise: 'destructive',
      imediato: 'destructive',
      alto: 'destructive',
      medio: 'default',
      baixo: 'secondary',
    };
    return colors[priority] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colors: any = {
      concluido: 'default',
      em_andamento: 'default',
      aguardando_resposta: 'secondary',
      cancelado: 'secondary',
    };
    return colors[status] || 'default';
  };

  const getSLAColor = (slaStatus: string) => {
    const colors: any = {
      dentro_prazo: 'default',
      vencido: 'destructive',
      proximo_vencimento: 'destructive',
    };
    return colors[slaStatus] || 'default';
  };

  const goToTicket = () => {
    if (ticket?.id) {
      navigate(`/admin/tickets?ticket=${ticket.id}`);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {ticket ? `Ticket ${ticket.codigo_ticket}` : 'Carregando...'}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : ticket ? (
          <ScrollArea className="max-h-[calc(90vh-8rem)]">
            <div className="space-y-6">
              {/* Informações principais */}
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold mb-2">Título</h3>
                  <p className="text-sm">{ticket.titulo || 'Sem título'}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={getStatusColor(ticket.status)}>
                    {ticket.status}
                  </Badge>
                  <Badge variant={getPriorityColor(ticket.prioridade)}>
                    {ticket.prioridade}
                  </Badge>
                  {ticket.status_sla && (
                    <Badge variant={getSLAColor(ticket.status_sla)}>
                      SLA: {ticket.status_sla}
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Unidade:</span>
                    <span className="font-medium">{ticket.unidades?.grupo || 'N/A'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Equipe:</span>
                    <span className="font-medium">{ticket.equipes?.nome || 'Não atribuído'}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">Criado:</span>
                    <span className="font-medium">
                      {format(new Date(ticket.data_abertura), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </span>
                  </div>
                  {ticket.atualizado_em && (
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Atualizado:</span>
                      <span className="font-medium">
                        {format(new Date(ticket.atualizado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Descrição do problema */}
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Descrição do Problema
                </h3>
                <p className="text-sm whitespace-pre-line break-words">
                  {ticket.descricao_problema || 'Sem descrição detalhada'}
                </p>
              </div>

              <Separator />

              {/* Conversa */}
              {ticket.ticket_mensagens && ticket.ticket_mensagens.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-3">
                    Conversa ({ticket.ticket_mensagens.length} mensagens)
                  </h3>
                  <div className="space-y-3">
                    {ticket.ticket_mensagens
                      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                      .map((msg: any) => (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-lg ${
                            msg.direcao === 'entrada' 
                              ? 'bg-muted ml-0 mr-12' 
                              : 'bg-primary/10 ml-12 mr-0'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium">
                              {msg.direcao === 'entrada' ? 'Franqueado' : msg.profiles?.nome || 'Suporte'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(msg.created_at), "dd/MM HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-line break-words">{msg.mensagem}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Botão para ir ao ticket completo */}
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
                <Button onClick={goToTicket} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  Abrir Ticket Completo
                </Button>
              </div>
            </div>
          </ScrollArea>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Ticket não encontrado
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};