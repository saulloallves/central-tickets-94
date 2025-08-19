
import { useState, useEffect } from 'react';
import { X, Clock, User, Building, Tag, AlertTriangle, MessageSquare, Send, Paperclip, Zap, Sparkles, Copy, Bot, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTicketMessages } from '@/hooks/useTickets';
import { useAISuggestion } from '@/hooks/useAISuggestion';
import { useAIChat } from '@/hooks/useAIChat';
import { CrisisButton } from './CrisisButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNowInSaoPaulo, formatDateTimeBR } from '@/lib/date-utils';

interface TicketDetailProps {
  ticketId: string;
  onClose: () => void;
}

export const TicketDetail = ({ ticketId, onClose }: TicketDetailProps) => {
  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [editedSuggestion, setEditedSuggestion] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  const [showAIChat, setShowAIChat] = useState(false);
  const [isSendingToFranqueado, setIsSendingToFranqueado] = useState(false);
  
  const { messages, sendMessage, loading: messagesLoading } = useTicketMessages(ticketId);
  const { suggestion, loading: suggestionLoading, generateSuggestion, markSuggestionUsed } = useAISuggestion(ticketId);
  const { chatHistory, loading: chatLoading, askAI } = useAIChat(ticketId);
  const { toast } = useToast();

  const fetchTicketDetails = async () => {
    try {
      // Fetch ticket first
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (ticketError || !ticketData) {
        console.error('Error fetching ticket:', ticketError);
        toast({
          title: "Erro",
          description: "Não foi possível carregar o ticket",
          variant: "destructive",
        });
        return;
      }

      // Fetch related data separately to avoid RLS issues
      const [unidadeRes, colaboradorRes, franqueadoRes, profileRes, equipeRes] = await Promise.all([
        supabase.from('unidades').select('grupo, id').eq('id', ticketData.unidade_id).single(),
        ticketData.colaborador_id ? supabase.from('colaboradores').select('nome_completo').eq('id', ticketData.colaborador_id).single() : Promise.resolve({ data: null }),
        ticketData.franqueado_id ? supabase.from('franqueados').select('name').eq('Id', Number(ticketData.franqueado_id)).single() : Promise.resolve({ data: null }),
        ticketData.criado_por ? supabase.from('profiles').select('nome_completo').eq('id', ticketData.criado_por).single() : Promise.resolve({ data: null }),
        ticketData.equipe_responsavel_id ? supabase.from('equipes').select('nome').eq('id', ticketData.equipe_responsavel_id).single() : Promise.resolve({ data: null })
      ]);

      // Combine the data
      const combinedData = {
        ...ticketData,
        unidades: unidadeRes.data,
        colaboradores: colaboradorRes.data,
        franqueados: franqueadoRes.data,
        profiles: profileRes.data,
        equipes: equipeRes.data
      };

      setTicket(combinedData);
    } catch (error) {
      console.error('Error fetching ticket details:', error);
      toast({
        title: "Erro",
        description: "Erro interno ao carregar ticket",
        variant: "destructive",
      });
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

  const handleCopySuggestion = () => {
    if (suggestion?.resposta) {
      navigator.clipboard.writeText(suggestion.resposta);
      toast({
        title: "Copiado",
        description: "Sugestão copiada para a área de transferência",
      });
    }
  };

  const handleEditAndSend = () => {
    setEditedSuggestion(suggestion?.resposta || '');
    setNewMessage(suggestion?.resposta || '');
  };

  const handleSendSuggestion = async (text: string) => {
    const success = await sendMessage(text);
    if (success && suggestion) {
      await markSuggestionUsed(suggestion.id, text);
      setNewMessage('');
      setEditedSuggestion('');
    }
  };

  const handleAskAI = async () => {
    if (!aiQuestion.trim()) return;
    
    await askAI(aiQuestion);
    setAiQuestion('');
  };

  const handleSendToFranqueado = async () => {
    if (!newMessage.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma mensagem antes de enviar",
        variant: "destructive"
      });
      return;
    }

    setIsSendingToFranqueado(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('process-notifications', {
        body: {
          ticketId: ticket.id,
          type: 'resposta_ticket_privado',
          textoResposta: newMessage
        }
      });

      if (error) {
        throw error;
      }

      if (data && !data.success) {
        toast({
          title: "Aviso",
          description: data.message,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Sucesso",
        description: "Mensagem enviada por WhatsApp ao franqueado",
      });

    } catch (error) {
      console.error('Error sending to franqueado:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem ao franqueado",
        variant: "destructive"
      });
    } finally {
      setIsSendingToFranqueado(false);
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
              <span>
                {ticket.colaboradores?.nome_completo || 
                 (ticket.franqueados?.name ? `${ticket.franqueados.name} (Franqueado)` : null) ||
                 (ticket.profiles?.nome_completo ? `${ticket.profiles.nome_completo} (Criador)` : null) ||
                 'N/A'}
              </span>
            </div>
            {ticket.franqueados && (
              <div className="text-xs text-muted-foreground">
                Franqueado ID: {ticket.franqueado_id}
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Badge variant={getPriorityVariant(ticket.prioridade)} className="w-fit">
              {ticket.prioridade === 'crise' && <Zap className="h-3 w-3 mr-1" />}
              {ticket.prioridade}
            </Badge>
            {ticket.equipes?.nome ? (
              <div className="flex items-center gap-2">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <span>{ticket.equipes.nome}</span>
              </div>
            ) : ticket.categoria && (
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

        {/* AI Suggestion */}
        <Collapsible open={showAISuggestion} onOpenChange={setShowAISuggestion}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                IA Sugestão de Resposta
              </div>
              {suggestion && !suggestion.foi_usada && (
                <Badge variant="secondary" className="ml-2">Nova</Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            {suggestion ? (
              <div className="space-y-3">
                <div className="p-3 bg-muted rounded-md">
                  <p className="text-sm">{suggestion.resposta}</p>
                  <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <span>Gerada em {formatDateTimeBR(suggestion.created_at)}</span>
                      {suggestion.log?.rag_hits !== undefined && suggestion.log?.kb_hits !== undefined && (
                        <span className="text-primary">
                          ({(suggestion.log.rag_hits + suggestion.log.kb_hits)} docs)
                        </span>
                      )}
                    </div>
                    {suggestion.foi_usada && (
                      <Badge variant="secondary" className="text-xs">✓ Utilizada</Badge>
                    )}
                  </div>
                </div>
                {!suggestion.foi_usada && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={handleCopySuggestion}>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleEditAndSend}>
                      Editar e Enviar
                    </Button>
                    <Button size="sm" onClick={() => handleSendSuggestion(suggestion.resposta)}>
                      <Send className="h-4 w-4 mr-2" />
                      Enviar
                    </Button>
                  </div>
                )}
              </div>
            ) : suggestionLoading ? (
              <div className="text-center py-4">
                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-3">
                  <Bot className="h-4 w-4 animate-spin" />
                  Gerando sugestão da IA...
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className="bg-primary h-2 rounded-full w-1/2 animate-pulse"></div>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-3">
                  Nenhuma sugestão gerada ainda
                </p>
                <Button 
                  onClick={generateSuggestion} 
                  disabled={suggestionLoading}
                  size="sm"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Gerar Sugestão
                </Button>
              </div>
            )}
            {suggestion && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={generateSuggestion} 
                disabled={suggestionLoading}
                className="w-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {suggestionLoading ? 'Gerando...' : 'Regenerar Sugestão'}
              </Button>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* AI Chat */}
        <Collapsible open={showAIChat} onOpenChange={setShowAIChat}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <Bot className="h-4 w-4" />
                Chat com IA
              </div>
              {chatHistory.length > 0 && (
                <Badge variant="secondary" className="ml-2">{chatHistory.length}</Badge>
              )}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 mt-3">
            <div className="max-h-40 overflow-y-auto space-y-2">
              {chatHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">
                  Nenhuma conversa ainda. Faça uma pergunta à IA!
                </p>
              ) : (
                chatHistory.map((chat) => (
                  <div key={chat.id} className="space-y-2">
                    <div className="p-2 bg-blue-50 rounded-md">
                      <p className="text-sm font-medium">Você:</p>
                      <p className="text-sm">{chat.mensagem}</p>
                    </div>
                    <div className="p-2 bg-green-50 rounded-md">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">IA:</p>
                        {chat.log?.rag_hits !== undefined && chat.log?.kb_hits !== undefined && (
                          <span className="text-xs text-primary">
                            {(chat.log.rag_hits + chat.log.kb_hits)} docs
                          </span>
                        )}
                      </div>
                      <p className="text-sm">{chat.resposta}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="space-y-2">
              <Input
                placeholder="Pergunte algo à IA sobre este ticket..."
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAskAI()}
              />
              <Button 
                size="sm" 
                onClick={handleAskAI}
                disabled={!aiQuestion.trim() || chatLoading}
                className="w-full"
              >
                <Bot className="h-4 w-4 mr-2" />
                {chatLoading ? 'Pensando...' : 'Perguntar'}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

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
                    <span title={formatDateTimeBR(message.created_at)}>
                      {formatDistanceToNowInSaoPaulo(message.created_at, { addSuffix: true })}
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
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                >
                  <Send className="h-4 w-4 mr-2" />
                  Enviar
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={handleSendToFranqueado}
                  disabled={!newMessage.trim() || isSendingToFranqueado}
                >
                  <Phone className="h-4 w-4 mr-2" />
                  {isSendingToFranqueado ? 'Enviando...' : 'WhatsApp Franqueado'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
