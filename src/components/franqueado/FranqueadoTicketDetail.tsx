import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, Send, Clock, MapPin, User, Phone, MessageSquare, AlertTriangle, Paperclip, RefreshCw, Check } from 'lucide-react';
import { ImageModal } from '@/components/ui/image-modal';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useFranqueadoUnits } from '@/hooks/useFranqueadoUnits';
import { useReopenTicket } from '@/hooks/useReopenTicket';

interface TicketMessage {
  id: string;
  mensagem: string;
  direcao: string;
  canal: string;
  created_at: string;
  usuario_id: string;
  anexos: any;
}

interface TicketData {
  id: string;
  codigo_ticket: string;
  titulo: string;
  descricao_problema: string;
  status: string;
  prioridade: string;
  status_sla: string;
  data_abertura: string;
  data_limite_sla: string;
  unidade_id: string;
  categoria: string;
  canal_origem: string;
  cliente_nome: string;
  cliente_telefone: string;
  cliente_email: string;
  reaberto_count: number;
  equipes?: {
    nome: string;
  };
}

interface FranqueadoTicketDetailProps {
  ticketId: string;
  onClose: () => void;
}

export function FranqueadoTicketDetail({ ticketId, onClose }: FranqueadoTicketDetailProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { units } = useFranqueadoUnits();
  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { reopenTicket } = useReopenTicket();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const fetchTicketData = async () => {
      setLoading(true);
      
      try {
        // Buscar dados do ticket com informações da equipe
        const { data: ticketData, error: ticketError } = await supabase
          .from('tickets')
          .select(`
            *,
            equipes!equipe_responsavel_id(nome)
          `)
          .eq('id', ticketId)
          .single();

        if (ticketError) {
          console.error('Erro ao buscar ticket:', ticketError);
          return;
        }

        console.log('Ticket data with team:', ticketData);
        setTicket(ticketData as any);

        // Buscar mensagens do ticket
        const { data: messagesData, error: messagesError } = await supabase
          .from('ticket_mensagens')
          .select('*')
          .eq('ticket_id', ticketId)
          .order('created_at', { ascending: true });

        if (messagesError) {
          console.error('Erro ao buscar mensagens:', messagesError);
          return;
        }

        setMessages(messagesData as any || []);
      } catch (error) {
        console.error('Erro ao buscar dados do ticket:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTicketData();
  }, [ticketId]);

  const handleReopenTicket = async () => {
    setIsReopening(true);
    try {
      const result = await reopenTicket(ticketId);
      if (result.success) {
        // Ticket será atualizado automaticamente via realtime
      }
    } finally {
      setIsReopening(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time subscription for ticket messages
  useEffect(() => {
    const channel = supabase
      .channel(`franqueado-ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_mensagens',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          console.log('Message change:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newMessage = payload.new as TicketMessage;
            setMessages(prev => [...prev, newMessage]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedMessage = payload.new as TicketMessage;
            setMessages(prev => prev.map(msg => 
              msg.id === updatedMessage.id ? updatedMessage : msg
            ));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMessages(prev => prev.filter(msg => msg.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  // Real-time subscription for ticket updates
  useEffect(() => {
    const channel = supabase
      .channel(`franqueado-ticket-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'tickets',
          filter: `id=eq.${ticketId}`
        },
        (payload) => {
          console.log('Ticket update:', payload);
          const updatedTicket = payload.new as TicketData;
          setTicket(updatedTicket);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    const maxSize = 16 * 1024 * 1024;
    const validFiles = files.filter(file => {
      if (file.size > maxSize) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede 16MB`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });
    
    setAttachments(prev => [...prev, ...validFiles]);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (): Promise<any[]> => {
    if (attachments.length === 0) return [];
    
    const uploadedFiles = [];
    
    for (const file of attachments) {
      try {
        const fileName = file.name
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/[^a-zA-Z0-9.-]/g, '_');
        
        const filePath = `${ticketId}/${Date.now()}_${fileName}`;
        
        const { data, error } = await supabase.storage
          .from('ticket-attachments')
          .upload(filePath, file);
        
        if (error) throw error;
        
        const { data: { publicUrl } } = supabase.storage
          .from('ticket-attachments')
          .getPublicUrl(filePath);
        
        uploadedFiles.push({
          url: publicUrl,
          nome: file.name,
          tipo: file.type.startsWith('image/') ? 'imagem' : file.type.startsWith('video/') ? 'video' : 'arquivo',
          type: file.type
        });
      } catch (error) {
        console.error('Erro ao fazer upload:', error);
        toast({
          title: "Erro no upload",
          description: `Falha ao enviar ${file.name}`,
          variant: "destructive"
        });
      }
    }
    
    return uploadedFiles;
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;
    if (!user) return;

    setSending(true);
    setIsUploading(true);
    
    try {
      const uploadedFiles = await uploadAttachments();
      
      const { error } = await supabase
        .from('ticket_mensagens')
        .insert({
          ticket_id: ticketId,
          mensagem: newMessage,
          direcao: 'saida',
          canal: 'web',
          usuario_id: user.id,
          anexos: uploadedFiles
        });

      if (error) {
        console.error('Erro ao enviar mensagem:', error);
        toast({
          title: "Erro",
          description: "Falha ao enviar mensagem",
          variant: "destructive"
        });
        return;
      }

      setNewMessage('');
      setAttachments([]);
      
      const { data: messagesData } = await supabase
        .from('ticket_mensagens')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      setMessages(messagesData as any || []);

      toast({
        title: "Sucesso",
        description: "Mensagem enviada com sucesso"
      });
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      toast({
        title: "Erro",
        description: "Falha ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setSending(false);
      setIsUploading(false);
    }
  };


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
      case 'alto': return 'secondary';
      case 'medio': return 'outline';
      case 'baixo': return 'outline';
      default: return 'outline';
    }
  };

  const getUnitInfo = (unidadeId: string) => {
    const unit = units.find(u => u.id === unidadeId);
    return unit ? `${unit.grupo} - ${unit.cidade}/${unit.uf}` : unidadeId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Carregando ticket...</p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">Ticket não encontrado</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h3 className="text-lg font-semibold">{ticket.codigo_ticket}</h3>
          <p className="text-sm text-muted-foreground">{ticket.titulo}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Ticket Info */}
      <div className="p-4 border-b space-y-3">
        <div className="flex flex-wrap gap-2">
          <Badge variant={getPriorityColor(ticket.prioridade)}>
            {ticket.prioridade}
          </Badge>
          <Badge className={getStatusColor(ticket.status)} variant="outline">
            {ticket.status}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Clock className="h-3 w-3" />
            SLA: {ticket.status_sla}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <MapPin className="h-3 w-3" />
              <span>Unidade:</span>
            </div>
            <p>{getUnitInfo(ticket.unidade_id)}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <User className="h-3 w-3" />
              <span>Equipe:</span>
            </div>
            <p>{ticket.equipes?.nome || 'Não atribuída'}</p>
          </div>
          <div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <Phone className="h-3 w-3" />
              <span>Telefone:</span>
            </div>
            <p>{ticket.cliente_telefone || 'Não informado'}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Categoria:</span>
            <p>{ticket.categoria || 'Não definida'}</p>
          </div>
        </div>

        <div>
          <span className="text-muted-foreground text-sm">Problema:</span>
          <p className="text-sm">{ticket.descricao_problema}</p>
        </div>
      </div>


      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.direcao === 'saida' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.direcao === 'saida'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.mensagem}</p>
                
                {/* Render anexos */}
                {message.anexos && Array.isArray(message.anexos) && message.anexos.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {message.anexos.map((attachment: any, idx: number) => {
                      const isImage = attachment.tipo === 'imagem' || attachment.type?.startsWith('image/');
                      const isVideo = attachment.tipo === 'video' || attachment.type?.startsWith('video/');
                      
                      if (isImage) {
                        return (
                          <ImageModal 
                            key={idx}
                            src={attachment.url} 
                            alt={attachment.nome || attachment.name || 'Imagem'}
                          >
                            <img 
                              src={attachment.url} 
                              alt={attachment.nome || attachment.name || 'Imagem'}
                              className="max-w-48 max-h-48 rounded object-cover cursor-pointer border hover:opacity-80 transition-opacity"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          </ImageModal>
                        );
                      }
                      
                      if (isVideo) {
                        return (
                          <video 
                            key={idx}
                            controls 
                            className="max-w-48 max-h-48 rounded border"
                          >
                            <source src={attachment.url} type={attachment.type || 'video/mp4'} />
                            Seu navegador não suporta reprodução de vídeo.
                          </video>
                        );
                      }
                      
                      return (
                        <div key={idx} className="flex items-center gap-2 p-2 bg-background/50 rounded border">
                          <a 
                            href={attachment.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-primary hover:underline"
                          >
                            📎 {attachment.nome || attachment.name || 'Anexo'}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                )}
                
                <p className="text-xs mt-1 opacity-70">
                  {new Date(message.created_at).toLocaleString('pt-BR')} - {message.canal}
                </p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Message Input */}
      {ticket.status === 'concluido' ? (
        <div className="p-4 border-t">
          <div className="bg-muted/50 border border-border rounded-lg p-4 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-green-600">
              <Check className="h-5 w-5" />
              <p className="font-medium">Ticket Concluído</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Este ticket foi finalizado. Para continuar a conversa, reabra o ticket.
            </p>
            <Button
              onClick={handleReopenTicket}
              disabled={isReopening}
              variant="outline"
              className="w-full"
            >
              {isReopening ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent mr-2" />
                  Reabrindo...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Reabrir Ticket
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            className="hidden"
            onChange={handleFileSelect}
          />
          
          {attachments.length > 0 && (
            <div className="mb-2 flex gap-2 flex-wrap">
              {attachments.map((file, idx) => (
                <Badge key={idx} variant="secondary" className="gap-1">
                  {file.type.startsWith('image/') ? '🖼️' : '🎥'} {file.name.substring(0, 20)}...
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => removeAttachment(idx)}
                  />
                </Badge>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 mb-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || isUploading}
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Textarea
              placeholder="Digite sua resposta... (Enter para enviar)"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              rows={3}
              className="resize-none flex-1"
              disabled={sending || isUploading}
            />
          </div>
          <Button 
            onClick={handleSendMessage} 
            disabled={sending || isUploading || (!newMessage.trim() && attachments.length === 0)}
            className="w-full"
          >
            <Send className="h-4 w-4 mr-2" />
            Enviar
          </Button>
        </div>
      )}
    </div>
  );
}