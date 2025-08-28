
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Calendar, MapPin, User, AlertTriangle, Clock, MessageSquare, History } from 'lucide-react';
import { TicketActions } from './TicketActions';
import { TicketConversaTimeline } from './TicketConversaTimeline';
import { useTickets, useTicketMessages } from '@/hooks/useTickets';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

interface TicketDetailProps {
  ticketId: string;
  onClose: () => void;
}

export function TicketDetail({ ticketId, onClose }: TicketDetailProps) {
  const { user } = useAuth();
  const { isAdmin, isSupervisor } = useRole();
  const { toast } = useToast();
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [conversa, setConversa] = useState<any[]>([]);

  // Messages hook for the legacy tab (relational messages)
  const { messages: legacyMessages, loading: messagesLoading, sendMessage } = useTicketMessages(ticketId);

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        setLoading(true);
        
        const { data, error } = await supabase
          .from('tickets')
          .select(`
            *,
            unidades(id, grupo, cidade, uf),
            colaboradores(nome_completo),
            equipes!equipe_responsavel_id(nome),
            atendimento_iniciado_por_profile:profiles!atendimento_iniciado_por(nome_completo),
            created_by_profile:profiles!criado_por(nome_completo)
          `)
          .eq('id', ticketId)
          .single();

        if (error) {
          console.error('Error fetching ticket:', error);
          toast({
            title: "Erro",
            description: "Não foi possível carregar o ticket",
            variant: "destructive"
          });
          return;
        }

        console.log('✅ Ticket carregado:', data);
        setTicket(data);
        
        // Load conversa from the JSON field
        const conversaData = data.conversa || [];
        setConversa(Array.isArray(conversaData) ? conversaData : []);
        
      } catch (error) {
        console.error('Error fetching ticket:', error);
        toast({
          title: "Erro",
          description: "Erro inesperado ao carregar ticket",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [ticketId, toast]);

  // Real-time subscription for ticket updates
  useEffect(() => {
    const channel = supabase
      .channel(`ticket-detail-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`
        },
        (payload) => {
          console.log('🔄 Ticket atualizado:', payload);
          const updatedTicket = payload.new as any;
          setTicket(updatedTicket);
          
          // Update conversa if changed
          if (updatedTicket.conversa) {
            const newConversa = Array.isArray(updatedTicket.conversa) ? updatedTicket.conversa : [];
            setConversa(newConversa);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-blue-100 text-blue-800';
      case 'em_atendimento': return 'bg-yellow-100 text-yellow-800';
      case 'aguardando_cliente': return 'bg-orange-100 text-orange-800';
      case 'escalonado': return 'bg-red-100 text-red-800';
      case 'concluido': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'destructive';
      case 'imediato': return 'destructive';
      case 'ate_1_hora': return 'secondary';
      case 'ainda_hoje': return 'outline';
      case 'posso_esperar': return 'outline';
      default: return 'outline';
    }
  };

  const getSLAColor = (status_sla: string) => {
    switch (status_sla) {
      case 'vencido': return 'destructive';
      case 'alerta': return 'secondary';
      case 'dentro_prazo': return 'outline';
      default: return 'outline';
    }
  };

  const handleNewMessage = (message: any) => {
    console.log('📨 Nova mensagem recebida:', message);
    // Timeline component handles this via real-time subscription
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Ticket não encontrado</h3>
          <Button variant="outline" onClick={onClose} className="mt-4">
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b">
        <div className="flex-1">
          <h2 className="text-2xl font-semibold">{ticket.codigo_ticket}</h2>
          <p className="text-muted-foreground">{ticket.titulo || ticket.descricao_problema}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs defaultValue="timeline" className="h-full flex flex-col">
          <div className="px-6 pt-4">
            <TabsList>
              <TabsTrigger value="timeline" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Timeline
              </TabsTrigger>
              <TabsTrigger value="details" className="flex items-center gap-2">
                <User className="h-4 w-4" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="legacy" className="flex items-center gap-2">
                <History className="h-4 w-4" />
                Mensagens Legacy
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Timeline Tab - NEW JSON-based conversation */}
          <TabsContent value="timeline" className="flex-1 px-6 pb-6 mt-4">
            <TicketConversaTimeline
              ticketId={ticketId}
              initialConversa={conversa}
              onNewMessage={handleNewMessage}
            />
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 px-6 pb-6 mt-4 overflow-y-auto">
            <div className="space-y-6">
              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                <Badge variant={getPriorityColor(ticket.prioridade)}>
                  {ticket.prioridade}
                </Badge>
                <Badge className={getStatusColor(ticket.status)} variant="outline">
                  {ticket.status}
                </Badge>
                <Badge variant={getSLAColor(ticket.status_sla)}>
                  SLA: {ticket.status_sla}
                </Badge>
                {ticket.categoria && (
                  <Badge variant="outline">{ticket.categoria}</Badge>
                )}
              </div>

              {/* Key Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>Unidade:</span>
                  </div>
                  <p className="font-medium">
                    {ticket.unidades ? 
                      `${ticket.unidades.grupo} - ${ticket.unidades.cidade}/${ticket.unidades.uf}` : 
                      ticket.unidade_id
                    }
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="h-4 w-4" />
                    <span>Equipe Responsável:</span>
                  </div>
                  <p className="font-medium">
                    {ticket.equipes?.nome || 'Não atribuída'}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    <span>Abertura:</span>
                  </div>
                  <p className="font-medium">
                    {new Date(ticket.data_abertura).toLocaleString('pt-BR')}
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>SLA Limite:</span>
                  </div>
                  <p className="font-medium">
                    {ticket.data_limite_sla ? 
                      new Date(ticket.data_limite_sla).toLocaleString('pt-BR') : 
                      'Não definido'
                    }
                  </p>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-3">
                <h3 className="font-medium">Descrição do Problema</h3>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="whitespace-pre-wrap">{ticket.descricao_problema}</p>
                </div>
              </div>

              {/* Actions */}
              <Separator />
              <TicketActions ticket={ticket} />
            </div>
          </TabsContent>

          {/* Legacy Messages Tab - Keep existing relational system */}
          <TabsContent value="legacy" className="flex-1 px-6 pb-6 mt-4">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Mensagens Legacy (Sistema Anterior)
                </CardTitle>
              </CardHeader>
              <CardContent className="h-full">
                <p className="text-sm text-muted-foreground mb-4">
                  Este é o sistema de mensagens anterior. Use a aba "Timeline" para a nova experiência.
                </p>
                {/* Keep existing message system for backwards compatibility */}
                <div className="text-center text-muted-foreground">
                  <p>Sistema de mensagens legacy aqui...</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
