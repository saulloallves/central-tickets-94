import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Clock, User, Building, CheckCircle, X, MessageSquare, Send, Eye } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { TicketDetail } from '@/components/tickets/TicketDetail';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Crisis {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  equipe_id: string;
}

interface CrisisTicket {
  id: string;
  codigo_ticket: string;
  titulo: string;
  descricao_problema: string;
  status: string;
  prioridade: string;
  data_abertura: string;
  unidade_id: string;
  franqueado_id: string | null;
  unidades: { grupo: string } | null;
  franqueados: { name: string } | null;
}

interface CrisisModalProps {
  crisis: Crisis;
  isOpen: boolean;
  onClose: () => void;
}

export function CrisisModal({ crisis, isOpen, onClose }: CrisisModalProps) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<CrisisTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);

  useEffect(() => {
    if (isOpen && crisis.id) {
      fetchCrisisTickets();
    }
  }, [isOpen, crisis.id]);

  const fetchCrisisTickets = async () => {
    setLoading(true);
    try {
      console.log('Buscando tickets para crise:', crisis.id);
      
      const { data, error } = await supabase
        .from('crise_ticket_links')
        .select(`
          ticket_id,
          tickets!inner(
            id,
            codigo_ticket,
            titulo,
            descricao_problema,
            status,
            prioridade,
            data_abertura,
            unidade_id,
            franqueado_id
          )
        `)
        .eq('crise_id', crisis.id);

      if (error) {
        console.error('Erro na query:', error);
        throw error;
      }

      console.log('Dados retornados:', data);

      const crisisTickets: CrisisTicket[] = data?.map(link => {
        const ticket = link.tickets as any;
        return {
          id: ticket.id,
          codigo_ticket: ticket.codigo_ticket,
          titulo: ticket.titulo || 'Sem título',
          descricao_problema: ticket.descricao_problema,
          status: ticket.status,
          prioridade: ticket.prioridade,
          data_abertura: ticket.data_abertura,
          unidade_id: ticket.unidade_id,
          franqueado_id: ticket.franqueado_id,
          unidades: null, // Será buscado separadamente se necessário
          franqueados: null // Será buscado separadamente se necessário
        };
      }) || [];

      console.log('Tickets processados:', crisisTickets);
      setTickets(crisisTickets);
    } catch (error) {
      console.error('Erro ao buscar tickets da crise:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar tickets da crise",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleResolveCrisis = async () => {
    try {
      setLoading(true);

      // Atualizar status da crise
      const { error: crisisError } = await supabase
        .from('crises')
        .update({
          status: 'encerrado',
          is_active: false,
          resolved_at: new Date().toISOString()
        })
        .eq('id', crisis.id);

      if (crisisError) throw crisisError;

      // Resolver todos os tickets vinculados
      const ticketIds = tickets.map(t => t.id);
      if (ticketIds.length > 0) {
        const { error: ticketsError } = await supabase
          .from('tickets')
          .update({ status: 'concluido' })
          .in('id', ticketIds);

        if (ticketsError) throw ticketsError;
      }

      toast({
        title: "Crise Resolvida",
        description: `Crise e ${tickets.length} tickets foram resolvidos com sucesso`,
        variant: "default"
      });

      onClose();
    } catch (error) {
      console.error('Erro ao resolver crise:', error);
      toast({
        title: "Erro",
        description: "Erro ao resolver crise",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setTicketModalOpen(true);
  };

  const handleCloseTicketDetail = () => {
    setTicketModalOpen(false);
    setSelectedTicketId(null);
  };

  const handleSendBroadcastMessage = async () => {
    if (!broadcastMessage.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma mensagem antes de enviar",
        variant: "destructive"
      });
      return;
    }

    setSendingMessage(true);
    try {
      // Buscar todas as unidades dos tickets relacionados
      const unidadeIds = [...new Set(tickets.map(t => t.unidade_id))];

      // Buscar grupos WhatsApp das unidades
      const { data: unidades, error: unidadesError } = await supabase
        .from('unidades')
        .select('id, grupo')
        .in('id', unidadeIds)
        .not('grupo', 'is', null);

      if (unidadesError) throw unidadesError;

      const grupos = unidades?.map(u => u.grupo).filter(Boolean) || [];

      if (grupos.length === 0) {
        toast({
          title: "Aviso",
          description: "Nenhum grupo WhatsApp encontrado para as unidades desta crise",
          variant: "destructive"
        });
        return;
      }

      // Enviar mensagem broadcast para cada grupo
      const promises = grupos.map(async (grupo) => {
        const { error } = await supabase.functions.invoke('zapi-send-message', {
          body: {
            phone: grupo,
            message: `🚨 *CRISE ATIVA* 🚨\n\n${crisis.titulo}\n\n${broadcastMessage}\n\n_Mensagem enviada automaticamente pelo sistema de gerenciamento de crises_`,
            ticketId: null // Mensagem não vinculada a ticket específico
          }
        });

        if (error) {
          console.error('Erro ao enviar para grupo:', grupo, error);
          throw error;
        }
      });

      await Promise.all(promises);

      toast({
        title: "Mensagem Enviada",
        description: `Mensagem enviada para ${grupos.length} grupo(s) WhatsApp`,
        variant: "default"
      });

      setBroadcastMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem broadcast:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem para os grupos",
        variant: "destructive"
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto':
        return 'bg-blue-500';
      case 'em_atendimento':
        return 'bg-yellow-500';
      case 'escalonado':
        return 'bg-orange-500';
      case 'concluido':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'crise':
        return 'destructive';
      case 'imediato':
        return 'destructive';
      case 'urgente':
        return 'destructive';
      case 'alta':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Gerenciamento de Crise
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info da Crise */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">{crisis.titulo}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Badge variant="destructive">{crisis.status}</Badge>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Iniciada em {format(new Date(crisis.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{tickets.length} tickets</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Lista de Tickets */}
          <Card className="flex-1">
            <CardHeader>
              <CardTitle className="text-base">Tickets Relacionados</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {loading ? (
                  <div className="text-center py-8">Carregando tickets...</div>
                ) : tickets.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum ticket encontrado
                  </div>
                ) : (
                  <div className="space-y-3">
                    {tickets.map((ticket) => (
                      <Card 
                        key={ticket.id} 
                        className="relative cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleTicketClick(ticket.id)}
                      >
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                                  {ticket.codigo_ticket}
                                </code>
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(ticket.status)}`} />
                                <Badge variant={getPriorityColor(ticket.prioridade)}>
                                  {ticket.prioridade}
                                </Badge>
                              </div>
                              
                              <h4 className="font-medium mb-1">{ticket.titulo}</h4>
                              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                                {ticket.descricao_problema}
                              </p>
                              
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Building className="h-3 w-3" />
                                  {ticket.unidade_id || 'Unidade não definida'}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(ticket.data_abertura), 'dd/MM HH:mm', { locale: ptBR })}
                                </div>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTicketClick(ticket.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Seção de Mensagem Broadcast */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Enviar Mensagem para Todos os Grupos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                placeholder="Digite sua mensagem para enviar para todos os grupos WhatsApp das unidades relacionadas a esta crise..."
                value={broadcastMessage}
                onChange={(e) => setBroadcastMessage(e.target.value)}
                rows={3}
              />
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground">
                  Será enviado para grupos WhatsApp de {[...new Set(tickets.map(t => t.unidade_id))].length} unidade(s)
                </p>
                <Button 
                  onClick={handleSendBroadcastMessage}
                  disabled={sendingMessage || !broadcastMessage.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  {sendingMessage ? 'Enviando...' : 'Enviar Mensagem'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Ações */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Resolver esta crise irá marcar todos os tickets como concluídos
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose}>
                <X className="h-4 w-4 mr-2" />
                Fechar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleResolveCrisis}
                disabled={loading}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Resolver Crise
              </Button>
            </div>
          </div>
        </div>

        {/* Modal de Detalhes do Ticket */}
        {selectedTicketId && ticketModalOpen && (
          <TicketDetail
            ticketId={selectedTicketId}
            onClose={handleCloseTicketDetail}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}