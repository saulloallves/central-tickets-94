import { useState, useEffect } from 'react';
import { X, Clock, User, Building, Tag, AlertTriangle, MessageSquare, Send, Paperclip, Zap, Sparkles, Copy, Bot, Phone } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { useTicketMessages } from '@/hooks/useTickets';
import { useAISuggestion } from '@/hooks/useAISuggestion';
import { useAIChat } from '@/hooks/useAIChat';
import { CrisisButton } from './CrisisButton';
import { TicketActions } from './TicketActions';
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
  const [equipes, setEquipes] = useState<Array<{ id: string; nome: string }>>([]);
  const [newMessage, setNewMessage] = useState('');
  const [editedSuggestion, setEditedSuggestion] = useState('');
  const [aiQuestion, setAiQuestion] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'suggestion' | 'messages'>('messages');
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
      const [unidadeRes, colaboradorRes, franqueadoRes, profileRes, equipeRes, atendimentoIniciadoRes] = await Promise.all([
        supabase.from('unidades').select('grupo, id').eq('id', ticketData.unidade_id).maybeSingle(),
        ticketData.colaborador_id ? supabase.from('colaboradores').select('nome_completo').eq('id', ticketData.colaborador_id).maybeSingle() : Promise.resolve({ data: null }),
        ticketData.franqueado_id ? supabase.from('franqueados').select('name').eq('id', Number(ticketData.franqueado_id)).maybeSingle() : Promise.resolve({ data: null }),
        ticketData.criado_por ? supabase.from('profiles').select('nome_completo').eq('id', ticketData.criado_por).maybeSingle() : Promise.resolve({ data: null }),
        ticketData.equipe_responsavel_id ? supabase.from('equipes').select('nome').eq('id', ticketData.equipe_responsavel_id).maybeSingle() : Promise.resolve({ data: null }),
        ticketData.atendimento_iniciado_por ? supabase.from('profiles').select('nome_completo').eq('id', ticketData.atendimento_iniciado_por).maybeSingle() : Promise.resolve({ data: null })
      ]);

      console.log('Ticket data:', {
        ticketId: ticketData.id,
        colaborador_id: ticketData.colaborador_id,
        franqueado_id: ticketData.franqueado_id,
        criado_por: ticketData.criado_por,
        colaborador: colaboradorRes.data,
        franqueado: franqueadoRes.data,
        profile: profileRes.data
      });

      // Combine the data
      const combinedData = {
        ...ticketData,
        unidades: unidadeRes.data,
        colaboradores: colaboradorRes.data,
        franqueados: franqueadoRes.data,
        profiles: profileRes.data,
        equipes: equipeRes.data,
        atendimento_iniciado_profile: atendimentoIniciadoRes.data
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
    fetchEquipes();
  }, [ticketId]);

  const fetchEquipes = async () => {
    try {
      const { data, error } = await supabase
        .from('equipes')
        .select('id, nome')
        .eq('ativo', true);

      if (error) {
        console.error('Error fetching equipes:', error);
        return;
      }

      setEquipes(data || []);
    } catch (error) {
      console.error('Error fetching equipes:', error);
    }
  };

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
          type: 'resposta_ticket_franqueado',
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

  const getTicketDisplayTitle = (ticket: any) => {
    if (ticket?.titulo) {
      return ticket.titulo;
    }
    // Fallback: primeiro 60 chars da descrição
    return ticket?.descricao_problema?.length > 60 
      ? ticket.descricao_problema.substring(0, 60) + '...'
      : ticket?.descricao_problema || 'Sem título';
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
    <Card className="h-full flex flex-col max-w-6xl w-full mx-auto">
      <CardHeader className="pb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <CardTitle className="text-xl line-clamp-2 mb-3">
              {getTicketDisplayTitle(ticket)}
            </CardTitle>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-sm text-muted-foreground px-2 py-1 bg-muted rounded">
                {ticket.codigo_ticket}
              </span>
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(ticket.status)}`} />
                <span className="text-sm text-muted-foreground capitalize font-medium">{ticket.status}</span>
              </div>
              {slaStatus && (
                <div className={`flex items-center gap-2 px-2 py-1 rounded ${slaStatus.color} bg-muted`}>
                  {slaStatus.icon}
                  <span className="text-xs font-medium">{slaStatus.text}</span>
                </div>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-shrink-0">
            {ticket.prioridade === 'crise' && (
              <Badge variant="destructive" className="whitespace-nowrap animate-pulse">
                <AlertTriangle className="h-3 w-3 mr-1" />
                EM CRISE
              </Badge>
            )}
            <TicketActions ticket={ticket} equipes={equipes} />
            <CrisisButton ticketId={ticket.id} currentPriority={ticket.prioridade} />
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-8 p-6">
        {/* Ticket Info Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 place-items-center w-full">
          {/* Unidade Card */}
          <Card className="border-l-4 border-l-blue-500 w-full max-w-xs h-20">
            <CardContent className="p-3 h-full flex items-center">
              <div className="flex items-center gap-3 w-full">
                <div className="p-1.5 bg-blue-50 rounded">
                  <Building className="h-3.5 w-3.5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {ticket.unidades?.grupo || ticket.unidade_id}
                  </div>
                  <div className="text-xs text-muted-foreground">Unidade</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Solicitante Card */}
          <Card className="border-l-4 border-l-green-500 w-full max-w-xs h-20">
            <CardContent className="p-3 h-full flex items-center">
              <div className="flex items-center gap-3 w-full">
                <div className="p-1.5 bg-green-50 rounded">
                  <User className="h-3.5 w-3.5 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-foreground truncate">
                    {ticket.colaboradores?.nome_completo || 
                     ticket.profiles?.nome_completo || 
                     (ticket.franqueado_id ? (ticket.franqueados?.name || "Franqueado") : "Sistema")}
                  </div>
                  <div className="text-xs text-muted-foreground">Solicitante</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sistema/Equipe Card */}
          <Card className="border-l-4 border-l-purple-500 w-full max-w-xs h-20">
            <CardContent className="p-3 h-full flex items-center">
              <div className="flex items-center gap-3 w-full">
                <div className="p-1.5 bg-purple-50 rounded">
                  <Tag className="h-3.5 w-3.5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={getPriorityVariant(ticket.prioridade)} className="text-xs px-2 py-0 h-4">
                      {ticket.prioridade === 'crise' && <Zap className="h-2 w-2 mr-1" />}
                      {ticket.prioridade?.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-sm font-semibold text-foreground truncate mt-1">
                    {ticket.equipes?.nome || 'Aguardando'}
                  </div>
                  <div className="text-xs text-muted-foreground">Equipe</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Atendimento Status */}
        {ticket.atendimento_iniciado_por && ticket.atendimento_iniciado_profile?.nome_completo && (
          <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-green-100 rounded-full">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-green-800">
                    Atendimento em andamento
                  </div>
                  <div className="text-xs text-green-700">
                    <span className="font-medium">{ticket.atendimento_iniciado_profile.nome_completo}</span>
                    {' • '}iniciado em {ticket.atendimento_iniciado_em 
                      ? new Date(ticket.atendimento_iniciado_em).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })
                      : 'Data não disponível'
                    }
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Problem Description */}
        <div className="space-y-4">
          <h4 className="font-semibold text-lg">Descrição do Problema</h4>
          <div className="p-6 bg-muted/50 rounded-lg border-l-4 border-primary">
            <p className="text-sm leading-relaxed text-foreground">
              {ticket.descricao_problema}
            </p>
          </div>
        </div>

        <Separator className="my-8" />

        {/* Tab Navigation */}
        <div className="space-y-6">
          {/* Tab Buttons */}
          <div className="flex gap-3 p-2 bg-muted rounded-lg">
            <Button
              variant={activeTab === 'suggestion' ? 'default' : 'ghost'}
              size="lg"
              onClick={() => setActiveTab('suggestion')}
              className="flex-1 relative h-14 text-base"
            >
              <Sparkles className="h-5 w-5 mr-3" />
              IA Sugestão
              {suggestion && !suggestion.foi_usada && (
                <Badge variant="secondary" className="ml-2 text-xs">Nova</Badge>
              )}
            </Button>
            <Button
              variant={activeTab === 'chat' ? 'default' : 'ghost'}
              size="lg"
              onClick={() => setActiveTab('chat')}
              className="flex-1 relative h-14 text-base"
            >
              <Bot className="h-5 w-5 mr-3" />
              Chat com IA
              {chatHistory.length > 0 && (
                <Badge variant="secondary" className="ml-2 text-xs">{chatHistory.length}</Badge>
              )}
            </Button>
            <Button
              variant={activeTab === 'messages' ? 'default' : 'ghost'}
              size="lg"
              onClick={() => setActiveTab('messages')}
              className="flex-1 relative h-14 text-base"
            >
              <MessageSquare className="h-5 w-5 mr-3" />
              Conversas
              <Badge variant="secondary" className="ml-2 text-xs">{messages.length}</Badge>
            </Button>
          </div>

          {/* Tab Content */}
          {activeTab === 'suggestion' && (
            <div className="space-y-4">
              {suggestion ? (
                <div className="space-y-3">
                  <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                    <p className="text-sm leading-relaxed">{suggestion.resposta}</p>
                    <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
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
                <div className="text-center py-6">
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-3">
                    <Bot className="h-4 w-4 animate-spin" />
                    Gerando sugestão da IA...
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full w-1/2 animate-pulse"></div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6">
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
            </div>
          )}

          {activeTab === 'chat' && (
            <div className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-3">
                {chatHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma conversa ainda. Faça uma pergunta à IA!
                  </p>
                ) : (
                  chatHistory.map((chat) => (
                    <div key={chat.id} className="space-y-2">
                      <div className="p-3 bg-blue-50 rounded-lg">
                        <p className="text-sm font-medium text-blue-900">Você:</p>
                        <p className="text-sm text-blue-800">{chat.mensagem}</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium text-green-900">IA:</p>
                          {chat.log?.rag_hits !== undefined && chat.log?.kb_hits !== undefined && (
                            <span className="text-xs text-primary">
                              {(chat.log.rag_hits + chat.log.kb_hits)} docs
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-green-800">{chat.resposta}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="space-y-4">
                <Input
                  placeholder="Pergunte algo à IA sobre este ticket..."
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAskAI()}
                  className="h-12 text-base"
                />
                <Button 
                  size="lg" 
                  onClick={handleAskAI}
                  disabled={!aiQuestion.trim() || chatLoading}
                  className="w-full h-12"
                >
                  <Bot className="h-5 w-5 mr-2" />
                  {chatLoading ? 'Pensando...' : 'Perguntar'}
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'messages' && (
            <div className="space-y-4">
              <div className="max-h-60 overflow-y-auto space-y-3">
                {messagesLoading ? (
                  <p className="text-sm text-muted-foreground">Carregando mensagens...</p>
                ) : messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`p-3 rounded-lg text-sm ${
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
              <div className="space-y-4">
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  rows={4}
                  className="text-base resize-none"
                />
                <div className="flex justify-between items-center">
                  <Button variant="outline" size="lg" className="h-12">
                    <Paperclip className="h-5 w-5 mr-2" />
                    Anexar
                  </Button>
                  <div className="flex gap-3">
                    <Button 
                      size="lg" 
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="h-12 px-6"
                    >
                      <Send className="h-5 w-5 mr-2" />
                      Enviar
                    </Button>
                    <Button 
                      size="lg" 
                      variant="outline"
                      onClick={handleSendToFranqueado}
                      disabled={!newMessage.trim() || isSendingToFranqueado || !ticket?.franqueado_id}
                      title={!ticket?.franqueado_id ? 'Nenhum franqueado vinculado a este ticket' : ''}
                      className="h-12 px-4"
                    >
                      <Phone className="h-5 w-5 mr-2" />
                      {isSendingToFranqueado ? 'Enviando...' : 'WhatsApp Franqueado'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
