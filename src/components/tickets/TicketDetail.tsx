import { useState, useRef } from 'react';
import { X, Clock, User, MessageSquare, Paperclip, Send, Download, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTickets, useTicketMessages, type Ticket } from '@/hooks/useTickets';
import { useRole } from '@/hooks/useRole';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface TicketDetailProps {
  ticketId: string;
  onClose: () => void;
}

export const TicketDetail = ({ ticketId, onClose }: TicketDetailProps) => {
  const { tickets, updateTicket, loading: ticketsLoading } = useTickets({
    search: '', status: '', categoria: '', prioridade: '', unidade_id: '', status_sla: ''
  });
  const { messages, sendMessage, loading: messagesLoading } = useTicketMessages(ticketId);
  const { isAdmin, isGerente } = useRole();
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ticket = tickets.find(t => t.id === ticketId);

  const canUpdate = isAdmin || isGerente;

  const handleStatusUpdate = async (newStatus: string) => {
    if (!ticket || !canUpdate) return;
    await updateTicket(ticket.id, { status: newStatus as any });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending) return;
    
    setSending(true);
    try {
      await sendMessage(newMessage);
      setNewMessage('');
    } finally {
      setSending(false);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
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

  const getSLAColor = (status_sla: string) => {
    switch (status_sla) {
      case 'vencido': return 'text-destructive';
      case 'alerta': return 'text-yellow-500';
      case 'dentro_prazo': return 'text-green-500';
      default: return 'text-muted-foreground';
    }
  };

  if (ticketsLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!ticket) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <p>Ticket não encontrado</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-[calc(100vh-12rem)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-mono">{ticket.codigo_ticket}</CardTitle>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>

      <CardContent className="flex flex-col h-full space-y-4">
        {/* Ticket Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", getStatusColor(ticket.status))} />
              <span className="font-medium capitalize">{ticket.status.replace('_', ' ')}</span>
            </div>
            
            {canUpdate && (
              <Select value={ticket.status} onValueChange={handleStatusUpdate}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="aberto">Aberto</SelectItem>
                  <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                  <SelectItem value="escalonado">Escalonado</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Prioridade:</span>
              <Badge variant="secondary" className="ml-2">
                {ticket.prioridade.replace('_', ' ')}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">SLA:</span>
              <span className={cn("ml-2 font-medium", getSLAColor(ticket.status_sla))}>
                {ticket.status_sla.replace('_', ' ')}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Categoria:</span>
              <span className="ml-2 capitalize">{ticket.categoria || 'Não definida'}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Canal:</span>
              <span className="ml-2 capitalize">{ticket.canal_origem}</span>
            </div>
          </div>

          <div>
            <span className="text-muted-foreground text-sm">Criado:</span>
            <span className="ml-2 text-sm">
              {formatDistanceToNow(new Date(ticket.created_at), { 
                addSuffix: true,
                locale: ptBR 
              })}
            </span>
          </div>

          <div>
            <h4 className="font-medium mb-2">Descrição do Problema</h4>
            <p className="text-sm text-muted-foreground bg-muted p-3 rounded-md">
              {ticket.descricao_problema}
            </p>
          </div>

          {ticket.arquivos && ticket.arquivos.length > 0 && (
            <div>
              <h4 className="font-medium mb-2">Arquivos Anexados</h4>
              <div className="flex flex-wrap gap-2">
                {ticket.arquivos.map((arquivo, index) => (
                  <Button key={index} variant="outline" size="sm">
                    <Paperclip className="h-3 w-3 mr-1" />
                    {arquivo.name || `Arquivo ${index + 1}`}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Messages Timeline */}
        <div className="flex-1 flex flex-col">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            Timeline de Mensagens
          </h4>

          <ScrollArea className="flex-1 pr-4">
            {messagesLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-16 w-full" />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma mensagem ainda
              </p>
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <div 
                    key={message.id}
                    className={cn(
                      "p-3 rounded-lg",
                      message.direcao === 'saida' 
                        ? "bg-primary text-primary-foreground ml-8" 
                        : "bg-muted mr-8"
                    )}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <User className="h-3 w-3" />
                      <span className="text-xs font-medium">
                        {message.profiles?.nome_completo || 'Sistema'}
                      </span>
                      <span className="text-xs opacity-70">
                        {formatDistanceToNow(new Date(message.created_at), { 
                          addSuffix: true,
                          locale: ptBR 
                        })}
                      </span>
                    </div>
                    <p className="text-sm">{message.mensagem}</p>
                    
                    {message.anexos && message.anexos.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {message.anexos.map((anexo, index) => (
                          <Button key={index} variant="ghost" size="sm" className="h-6 px-2">
                            <Paperclip className="h-3 w-3 mr-1" />
                            <span className="text-xs">{anexo.name}</span>
                          </Button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* Message Input */}
          <div className="pt-4 space-y-2">
            <Textarea
              placeholder="Digite sua mensagem..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={3}
            />
            <div className="flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={handleFileUpload}>
                <Paperclip className="h-4 w-4 mr-2" />
                Anexar
              </Button>
              <Button 
                onClick={handleSendMessage} 
                disabled={!newMessage.trim() || sending}
                size="sm"
              >
                <Send className="h-4 w-4 mr-2" />
                {sending ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept="image/*,.pdf,.xlsx,.csv,.mp3,.m4a,.ogg"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};