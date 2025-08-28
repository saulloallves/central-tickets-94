import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare, User, Headphones, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

interface ConversaMessage {
  autor: 'franqueado' | 'suporte' | 'interno';
  texto: string;
  timestamp: string;
  canal: string;
}

interface TicketConversaTimelineProps {
  ticketId: string;
  initialConversa?: ConversaMessage[];
  onNewMessage?: (message: ConversaMessage) => void;
}

// Helper function to safely convert Json to ConversaMessage[]
const convertJsonToConversa = (jsonData: Json): ConversaMessage[] => {
  if (!Array.isArray(jsonData)) return [];
  
  return jsonData.map(item => {
    // Check if item is an object and has the required properties
    if (
      typeof item === 'object' && 
      item !== null && 
      'autor' in item && 
      'texto' in item && 
      'timestamp' in item
    ) {
      const obj = item as { [key: string]: Json };
      return {
        autor: (obj.autor as string) || 'franqueado',
        texto: (obj.texto as string) || '',
        timestamp: (obj.timestamp as string) || new Date().toISOString(),
        canal: (obj.canal as string) || 'web'
      } as ConversaMessage;
    }
    return null;
  }).filter((item): item is ConversaMessage => item !== null);
};

export function TicketConversaTimeline({ 
  ticketId, 
  initialConversa = [], 
  onNewMessage 
}: TicketConversaTimelineProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversa, setConversa] = useState<ConversaMessage[]>(initialConversa);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load conversa from ticket.conversa field
  useEffect(() => {
    const loadConversa = async () => {
      if (initialConversa.length > 0) {
        setConversa(initialConversa);
        return;
      }

      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('tickets')
          .select('conversa')
          .eq('id', ticketId)
          .single();

        if (error) {
          console.error('Erro ao carregar conversa:', error);
          return;
        }

        const conversaData = convertJsonToConversa(data?.conversa || []);
        console.log('📖 Conversa carregada:', conversaData);
        setConversa(conversaData);
      } catch (error) {
        console.error('Erro ao buscar conversa:', error);
      } finally {
        setLoading(false);
      }
    };

    loadConversa();
  }, [ticketId, initialConversa]);

  // Auto scroll on new messages
  useEffect(() => {
    scrollToBottom();
  }, [conversa]);

  // Real-time subscription for ticket updates (including conversa changes)
  useEffect(() => {
    const channel = supabase
      .channel(`ticket-conversa-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`
        },
        (payload) => {
          console.log('🔄 Ticket atualizado (conversa):', payload);
          const updatedTicket = payload.new as any;
          if (updatedTicket.conversa) {
            const newConversa = convertJsonToConversa(updatedTicket.conversa);
            setConversa(newConversa);
            
            // Notify parent about new message if there are more messages than before
            if (newConversa.length > conversa.length) {
              const latestMessage = newConversa[newConversa.length - 1];
              onNewMessage?.(latestMessage);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId, conversa.length, onNewMessage]);

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user) return;

    setSending(true);
    try {
      // Use the RPC function to append message
      const { data, error } = await supabase.rpc('append_to_ticket_conversa', {
        p_ticket_id: ticketId,
        p_autor: 'suporte',
        p_texto: newMessage.trim(),
        p_canal: 'web',
        p_usuario_id: user.id
      });

      if (error) {
        console.error('Erro ao enviar mensagem:', error);
        toast({
          title: "Erro",
          description: "Não foi possível enviar a mensagem",
          variant: "destructive"
        });
        return;
      }

      console.log('✅ Mensagem enviada:', data);
      
      // Clear input
      setNewMessage('');
      
      // Update local state with the returned conversa
      if (data) {
        const updatedConversa = convertJsonToConversa(data);
        setConversa(updatedConversa);
      }

      toast({
        title: "Sucesso",
        description: "Mensagem enviada com sucesso"
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Erro inesperado ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setSending(false);
    }
  };

  const getAuthorIcon = (autor: string) => {
    switch (autor) {
      case 'franqueado':
        return <User className="h-4 w-4" />;
      case 'suporte':
        return <Headphones className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getAuthorColor = (autor: string) => {
    switch (autor) {
      case 'franqueado':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'suporte':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Timeline de Conversa
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
            <span className="ml-2 text-muted-foreground">Carregando conversa...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Timeline de Conversa ({conversa.length})
        </CardTitle>
      </CardHeader>
      
      <CardContent className="flex-1 flex flex-col p-0">
        {/* Messages Area */}
        <ScrollArea className="flex-1 px-4 max-h-96">
          <div className="space-y-4 py-2">
            {conversa.length === 0 ? (
              <div className="flex items-center justify-center p-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mr-2" />
                <span>Nenhuma mensagem na conversa ainda</span>
              </div>
            ) : (
              conversa.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.autor === 'suporte' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 border ${
                      message.autor === 'suporte'
                        ? 'bg-primary text-primary-foreground border-primary/20'
                        : getAuthorColor(message.autor)
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      {getAuthorIcon(message.autor)}
                      <span className="text-xs font-medium capitalize">
                        {message.autor}
                      </span>
                      <span className="text-xs opacity-70 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(message.timestamp).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{message.texto}</p>
                    {message.canal && (
                      <div className="text-xs opacity-60 mt-1">
                        via {message.canal}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* Message Input */}
        <div className="p-4 border-t bg-muted/30">
          <div className="flex gap-2">
            <Textarea
              placeholder="Digite sua resposta..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={2}
              className="resize-none flex-1"
              disabled={sending}
            />
            <Button 
              onClick={handleSendMessage}
              disabled={!newMessage.trim() || sending}
              size="sm"
              className="px-3"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
