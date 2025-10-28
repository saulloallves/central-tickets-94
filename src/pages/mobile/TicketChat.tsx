import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Send, AlertTriangle, Loader2, Clock, Paperclip, X, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useMobileTicketMessages } from '@/hooks/useMobileTicketMessages';
import { useReopenTicket } from '@/hooks/useReopenTicket';
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
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const { messages, loading: messagesLoading, sending, sendMessage, refetch } = useMobileTicketMessages(ticketId!);
  const { reopenTicket } = useReopenTicket();

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

  const handleReopenTicket = async () => {
    if (!senhaWeb) {
      toast({
        title: 'Erro',
        description: 'Senha web não encontrada',
        variant: 'destructive'
      });
      return;
    }

    setIsReopening(true);
    try {
      const result = await reopenTicket(ticketId!, senhaWeb);
      if (result.success) {
        // Recarregar dados do ticket
        const { data } = await supabase
          .from('tickets')
          .select('id, codigo_ticket, titulo, status, prioridade, status_sla')
          .eq('id', ticketId)
          .maybeSingle();
        
        if (data) setTicket(data);
      }
    } finally {
      setIsReopening(false);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
    if (fileInputRef.current) fileInputRef.current.value = '';
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
        
        const { error } = await supabase.storage
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

  const handleSend = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;

    if (!senhaWeb) {
      toast({
        title: 'Erro de autenticação',
        description: 'Senha web não encontrada',
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    try {
      const uploadedFiles = await uploadAttachments();
      const success = await sendMessage(newMessage, senhaWeb, uploadedFiles);
      
      if (success) {
        setNewMessage('');
        setAttachments([]);
        
        // ✅ Atualizar mensagens imediatamente após envio
        await refetch();
        
        toast({
          title: 'Mensagem enviada',
          description: 'Sua mensagem foi enviada com sucesso'
        });
      } else {
        toast({
          title: 'Erro ao enviar',
          description: 'Verifique sua senha e tente novamente',
          variant: 'destructive'
        });
      }
    } catch (err) {
      console.error('Erro no handleSend:', err);
      toast({
        title: 'Erro ao enviar',
        description: 'Ocorreu um erro inesperado',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto': return 'text-blue-700 border-blue-200';
      case 'em_atendimento': return 'text-yellow-700 border-yellow-200';
      case 'concluido': return 'text-green-700 border-green-200';
      default: return 'text-gray-700 border-gray-200';
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
        <div className="flex items-center gap-2 p-2">
          <button 
            onClick={() => navigate(`/mobile/tickets?codigo_grupo=${codigoGrupo}&senha_web=${senhaWeb}`)}
            className="p-2 -ml-2 hover:bg-primary-foreground/10 rounded-full transition-colors"
            style={{ minHeight: '44px', minWidth: '44px' }}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="flex-1">
            <p className="font-bold text-sm">{ticket.codigo_ticket}</p>
            <p className="text-xs opacity-90 line-clamp-1">{ticket.titulo}</p>
          </div>
        </div>
        
        {/* Status e Prioridade */}
        <div className="flex gap-2 px-2 pb-2">
          <Badge variant="outline" className={`text-[10px] bg-white ${getStatusColor(ticket.status)}`}>
            {ticket.status}
          </Badge>
          <Badge variant="outline" className="text-[10px] bg-white border-border">
            {ticket.prioridade}
          </Badge>
          {ticket.status_sla === 'vencido' && (
            <Badge variant="destructive" className="text-[10px] bg-white">
              <Clock className="h-3 w-3 mr-1" />
              SLA vencido
            </Badge>
          )}
        </div>
      </header>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-muted/30">
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
      <div className="sticky bottom-0 bg-background border-t p-2 safe-area-bottom">
        {ticket.status === 'concluido' ? (
          <div className="space-y-2">
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-center">
              <p className="text-sm text-muted-foreground mb-2">
                ✅ Este ticket está concluído
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
          <>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*"
              className="hidden"
              onChange={handleFileSelect}
            />
            
            {attachments.length > 0 && (
              <div className="mb-1 flex gap-1 flex-wrap">
                {attachments.map((file, idx) => (
                  <Badge key={idx} variant="secondary" className="gap-1">
                    {file.type.startsWith('image/') ? '🖼️' : '🎥'} {file.name.substring(0, 15)}...
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeAttachment(idx)}
                    />
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="icon"
                onClick={() => fileInputRef.current?.click()}
                disabled={sending || isUploading}
                style={{ minHeight: '40px', minWidth: '40px' }}
              >
                <Paperclip className="h-4 w-4" />
              </Button>
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
                disabled={sending || isUploading}
                className="flex-1 text-base py-2"
                style={{ fontSize: '16px' }}
              />
              <Button 
                onClick={handleSend} 
                disabled={sending || isUploading || (!newMessage.trim() && attachments.length === 0)}
                size="icon"
                style={{ minHeight: '40px', minWidth: '40px' }}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}