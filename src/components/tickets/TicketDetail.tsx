
import { useState, useEffect } from 'react';
import { X, Clock, User, Building, Tag, AlertTriangle, MessageSquare, Send, Paperclip, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { useTicketMessages } from '@/hooks/useTickets';
import { CrisisButton } from './CrisisButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TicketDetailProps {
  ticketId: string;
  onClose: () => void;
}

export const TicketDetail = ({ ticketId, onClose }: TicketDetailProps) => {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const { messages, sendMessage, loading: messagesLoading } = useTicketMessages(ticketId);
  const { toast } = useToast();

  const fetchTicketDetails = async () => {
    try {
      const { data, error } = await supabase
        .from('tickets')
        .select(`
          *,
          unidades!tickets_unidade_id_fkey(grupo, id),
          colaboradores(nome_completo),
          franqueados(name),
          profiles!tickets_criado_por_fkey(nome_completo)
        `)
        .eq('id', ticketId)
        .single();

      if (error) {
        console.error('Error fetching ticket details:', error);
        toast({
          title: "Erro",
          description: "Não foi possível carregar os detalhes do ticket",
          variant: "destructive",
        });
        return;
      }

      setTicket(data);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketDetails();
  }, [ticketId]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    const success = await sendMessage(newMessage);
    if (success) {
      setNewMessage('');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-blue-500';
      case 'em_atendimento': return 'bg-yellow-500';
      case 'escalonado': return 'bg-orange-500';
      case 'concluido': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getPriorityVariant = (prioridade: string) => {
    switch (prioridade) {
      case 'crise': return 'destructive';
      case 'urgente': return 'destructive';
      case 'alta': return 'outline';
      default: return 'secondary';
    }
  };

  const getSLAStatus = () => {
    if (!ticket?.data_limite_sla) return null;
    
    const now = Date.now();
    const deadline = new Date(ticket.data_limite_sla).getTime();
    const remaining = deadline - now;
    const isOverdue = remaining < 0;
    
    if (isOverdue) {
      return {
        color: 'text-red-600',
        icon: <AlertTriangle className="h-4 w-4" />,
        text: `Vencido há ${Math.abs(Math.round(remaining / (1000 * 60)))} min`
      };
    }
    
    const hoursRemaining = Math.round(remaining / (1000 * 60 * 60));
    if (hoursRemaining < 2) {
      return {
        color: 'text-orange-600',
        icon: <Clock className="h-4 w-4" />,
        text: `${Math.round(remaining / (1000 * 60))} min restantes`
      };
    }
    
    return {
      color: 'text-green-600',
      icon: <Clock className="h-4 w-4" />,
      text: `${hoursRemaining}h restantes`
    };
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Carregando...</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Carregando detalhes do ticket...</p>
        </CardContent>
      </Card>
    );
  }

  if (!ticket) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Erro</CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Ticket não encontrado</p>
        </CardContent>
      </Card>
    );
  }

  const slaStatus = getSLAStatus();

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{ticket.codigo_ticket}</CardTitle>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${getStatusColor(ticket.status)}`} />
              <span className="text-sm text-muted-foreground capitalize">{ticket.status}</span>
              {slaStatus && (
                <div className={`flex items-center gap-1 ${slaStatus.color}`}>
                  {slaStatus.icon}
                  <span className="text-xs font-medium">{slaStatus.text}</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CrisisButton ticketId={ticket.id} currentPriority={ticket.prioridade} />
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4">
        {/* Ticket Info */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Building className="h-4 w-4 text-muted-foreground" />
              <span>{ticket.unidades?.grupo || ticket.unidade_id}</span>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span>{ticket.colaboradores?.nome_completo || ticket.franqueados?.name || 'N/A'}</span>
            </div>
          </div>
          <div className="space-y-2">
            <Badge variant={getPriorityVariant(ticket.prioridade)} className="w-fit">
              {ticket.prioridade === 'crise' && <Zap className="h-3 w-3 mr-1" />}
              {ticket.prioridade}
            </Badge>
            {ticket.categoria && (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span className="capitalize">{ticket.categoria}</span>
              </div>
            )}
          </div>
        </div>

        {/* Problem Description */}
        <div>
          <h4 className="font-medium mb-2">Descrição do Problema</h4>
          <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
            {ticket.descricao_problema}
          </p>
        </div>

        <Separator />

        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4" />
            <h4 className="font-medium">Conversas</h4>
            <Badge variant="secondary">{messages.length}</Badge>
          </div>

          <div className="flex-1 space-y-3 max-h-60 overflow-y-auto">
            {messagesLoading ? (
              <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
            ) : messages.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`p-3 rounded-md text-sm ${
                    message.direcao === 'saida' 
                      ? 'bg-primary text-primary-foreground ml-8' 
                      : 'bg-muted mr-8'
                  }`}
                >
                  <p>{message.mensagem}</p>
                  <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                    <span>{message.profiles?.nome_completo || 'Sistema'}</span>
                    <span>
                      {formatDistanceToNow(new Date(message.created_at), { 
                        addSuffix: true, 
                        locale: ptBR 
                      })}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Send Message */}
          <div className="mt-4 space-y-2">
            <Textarea
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
            />
            <div className="flex justify-between">
              <Button variant="outline" size="sm">
                <Paperclip className="h-4 w-4 mr-2" />
                Anexar
              </Button>
              <Button 
                size="sm" 
                onClick={handleSendMessage}
                disabled={!newMessage.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
