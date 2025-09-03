import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Clock, User, Building, CheckCircle, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
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

  useEffect(() => {
    if (isOpen && crisis.id) {
      fetchCrisisTickets();
    }
  }, [isOpen, crisis.id]);

  const fetchCrisisTickets = async () => {
    setLoading(true);
    try {
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
            unidades(grupo),
            franqueados(name)
          )
        `)
        .eq('crise_id', crisis.id);

      if (error) {
        throw error;
      }

      const crisisTickets: CrisisTicket[] = data?.map(link => ({
        id: (link.tickets as any).id,
        codigo_ticket: (link.tickets as any).codigo_ticket,
        titulo: (link.tickets as any).titulo,
        descricao_problema: (link.tickets as any).descricao_problema,
        status: (link.tickets as any).status,
        prioridade: (link.tickets as any).prioridade,
        data_abertura: (link.tickets as any).data_abertura,
        unidades: (link.tickets as any).unidades,
        franqueados: (link.tickets as any).franqueados
      })) || [];

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
                      <Card key={ticket.id} className="relative">
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
                                {ticket.unidades && (
                                  <div className="flex items-center gap-1">
                                    <Building className="h-3 w-3" />
                                    {ticket.unidades.grupo}
                                  </div>
                                )}
                                {ticket.franqueados && (
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {ticket.franqueados.name}
                                  </div>
                                )}
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {format(new Date(ticket.data_abertura), 'dd/MM HH:mm', { locale: ptBR })}
                                </div>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </ScrollArea>
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
      </DialogContent>
    </Dialog>
  );
}