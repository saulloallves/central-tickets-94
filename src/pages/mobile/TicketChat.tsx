import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, AlertTriangle, Loader2, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMobileTicketMessages } from '@/hooks/useMobileTicketMessages';
import { MobileChatBubble } from '@/components/mobile/MobileChatBubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

interface Ticket {
  id: string;
  codigo_ticket: string;
  titulo: string;
  status: string;
  prioridade: string;
  status_sla: string;
}

export default function TicketChat() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const codigoGrupo = searchParams.get('codigo_grupo');
  const senhaWeb = searchParams.get('senha_web');
  const { toast } = useToast();
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { messages, loading: messagesLoading, sending, sendMessage } = useMobileTicketMessages(ticketId!);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    const fetchTicket = async () => {
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('id, codigo_ticket, titulo, status, prioridade, status_sla')
          .eq('id', ticketId)
          .maybeSingle();

        if (error) throw error;
        setTicket(data);
      } catch (error) {
        console.error('Erro ao buscar ticket:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTicket();
  }, [ticketId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    if (!senhaWeb) {
      toast({
        title: 'Erro de autenticação',
        description: 'Senha web não encontrada',
        variant: 'destructive'
      });
      return;
    }

    const success = await sendMessage(newMessage, senhaWeb);
    
    if (success) {
      setNewMessage('');
      toast({
        title: 'Mensagem enviada',
        description: 'Sua mensagem foi enviada com sucesso'
      });
    } else {
      toast({
        title: 'Erro ao enviar',
        description: 'Senha inválida ou erro ao enviar mensagem',
        variant: 'destructive'
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'bg-blue-500/10 text-blue-700 border-blue-200';
      case 'em_atendimento': return 'bg-yellow-500/10 text-yellow-700 border-yellow-200';
      case 'concluido': return 'bg-green-500/10 text-green-700 border-green-200';
      default: return 'bg-gray-500/10 text-gray-700 border-gray-200';
    }
  };

  if (loading || messagesLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <p className="text-muted-foreground">Carregando conversa...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Ticket não encontrado</h3>
          <Button onClick={() => navigate(`/mobile/tickets?codigo_grupo=${codigoGrupo}`)}>
            Voltar para lista
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header Fixo */}
      <header className="sticky top-0 z-10 bg-primary text-primary-foreground shadow-md">
        <div className="flex items-center gap-3 p-4">
          <button 
            onClick={() => navigate(`/mobile/tickets?codigo_grupo=${codigoGrupo}&senha_web=${senhaWeb}`)}
            className="p-2 -ml-2 hover:bg-primary-foreground/10 rounded-full transition-colors"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="font-bold">{ticket.codigo_ticket}</p>
            <p className="text-sm opacity-90 line-clamp-1">{ticket.titulo}</p>
          </div>
        </div>
        
        {/* Status e Prioridade */}
        <div className="flex gap-2 px-4 pb-3">
          <Badge variant="outline" className={`text-xs ${getStatusColor(ticket.status)}`}>
            {ticket.status}
          </Badge>
          <Badge variant="outline" className="text-xs">
            {ticket.prioridade}
          </Badge>
          {ticket.status_sla === 'vencido' && (
            <Badge variant="destructive" className="text-xs">
              <Clock className="h-3 w-3 mr-1" />
              SLA vencido
            </Badge>
          )}
        </div>
      </header>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/30">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma mensagem ainda</p>
          </div>
        ) : (
          messages.map(message => (
            <MobileChatBubble key={message.id} message={message} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Fixo */}
      <div className="sticky bottom-0 bg-background border-t p-4 safe-area-bottom">
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Digite sua mensagem..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            disabled={sending}
            className="flex-1 text-base"
            style={{ fontSize: '16px' }}
          />
          <Button 
            onClick={handleSend} 
            disabled={sending || !newMessage.trim()}
            size="icon"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
