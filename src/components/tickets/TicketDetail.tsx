import { useState, useEffect } from 'react';
import { X, Clock, User, Building, Tag, AlertTriangle, MessageSquare, Send, Paperclip, Zap, Sparkles, Copy, Bot, Phone, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
    setActiveTab('messages'); // Muda para a aba Conversas para enviar
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
    
    const question = aiQuestion.trim();
    setAiQuestion(''); // Clear input immediately for better UX
    await askAI(question);
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

  const handleTeamChange = async (equipeId: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          equipe_responsavel_id: equipeId || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) {
        throw error;
      }

      // Update local ticket state
      setTicket(prev => ({
        ...prev,
        equipe_responsavel_id: equipeId || null,
        equipes: equipes.find(e => e.id === equipeId) || null
      }));

      toast({
        title: "Sucesso",
        description: "Equipe responsável atualizada",
      });

      // Refresh ticket details to get latest data
      fetchTicketDetails();
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar equipe responsável",
        variant: "destructive"
      });
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
      case 'imediato': return 'destructive';
      case 'ate_1_hora': return 'outline';
      case 'ainda_hoje': return 'secondary';
      case 'posso_esperar': return 'secondary';
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
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-muted-foreground">Carregando detalhes do ticket...</span>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <h3 className="text-lg font-medium text-red-600 mb-2">Erro ao carregar ticket</h3>
          <p className="text-muted-foreground">Não foi possível carregar os detalhes do ticket. Tente novamente.</p>
        </div>
      </div>
    );
  }

  const slaStatus = getSLAStatus();

  return (
    <div className="w-full h-full flex flex-col overflow-hidden p-6">
        {/* Header */}
        <div className="flex-shrink-0 border-b pb-4 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl line-clamp-2 mb-3 font-bold text-foreground">
                {getTicketDisplayTitle(ticket)}
              </h2>
              <div className="flex items-center gap-3 flex-wrap">
                <Badge variant="outline" className="font-mono text-sm">
                  {ticket.codigo_ticket}
                </Badge>
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${getStatusColor(ticket.status)}`} />
                  <span className="text-sm text-muted-foreground capitalize font-medium">{ticket.status}</span>
                </div>
                {slaStatus && (
                  <Badge variant="outline" className={`${slaStatus.color} flex items-center gap-1`}>
                    {slaStatus.icon}
                    <span className="text-xs">{slaStatus.text}</span>
                  </Badge>
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
              <CrisisButton ticketId={ticket.id} currentPriority={ticket.prioridade} />
              <TicketActions ticket={ticket} equipes={equipes} />
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto space-y-6">
          {/* Info Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Unidade Card */}
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-50 rounded-lg">
                    <Building className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Unidade</p>
                    <p className="font-semibold text-sm truncate">
                      {ticket.unidades?.grupo || ticket.unidade_id}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Solicitante Card */}
            <Card className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-50 rounded-lg">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-muted-foreground mb-1">Solicitante</p>
                    <p className="font-semibold text-sm truncate">
                      {ticket.colaboradores?.nome_completo || 
                       ticket.profiles?.nome_completo || 
                       (ticket.franqueado_id ? (ticket.franqueados?.name || "Franqueado") : "Sistema")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prioridade/Equipe Card */}
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-50 rounded-lg">
                    <Tag className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-muted-foreground">Prioridade</p>
                      <Badge variant={getPriorityVariant(ticket.prioridade)} className="text-xs h-5">
                        {ticket.prioridade === 'crise' && <Zap className="h-3 w-3 mr-1" />}
                        {ticket.prioridade?.toUpperCase()}
                      </Badge>
                    </div>
                    <p className="font-semibold text-sm truncate">
                      {ticket.equipes?.nome || 'Aguardando designação'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Team Management */}
          <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900">Equipe Responsável</h4>
                  <p className="text-xs text-blue-700">Altere a equipe responsável pelo atendimento</p>
                </div>
              </div>
              <Select
                value={ticket.equipe_responsavel_id || "none"}
                onValueChange={(value) => handleTeamChange(value === "none" ? "" : value)}
              >
                <SelectTrigger className="w-full bg-white border-blue-200">
                  <SelectValue placeholder="Selecionar equipe..." />
                </SelectTrigger>
                <SelectContent className="bg-white border border-border shadow-lg z-[60]">
                  <SelectItem value="none">Nenhuma equipe</SelectItem>
                  {equipes.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          {/* Atendimento Status */}
          {ticket.atendimento_iniciado_por && ticket.atendimento_iniciado_profile?.nome_completo && (
            <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
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
          <Card>
            <CardContent className="p-4">
              <h4 className="font-semibold text-base mb-3">Descrição do Problema</h4>
              <div className="p-4 bg-muted/50 rounded-lg border-l-4 border-primary">
                <p className="text-sm leading-relaxed text-foreground">
                  {ticket.descricao_problema}
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Tab Navigation */}
          <div className="space-y-4">
            {/* Tab Buttons */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <Button
                variant={activeTab === 'suggestion' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('suggestion')}
                className="flex-1 h-10"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                IA Sugestão
                {suggestion && !suggestion.foi_usada && (
                  <Badge variant="secondary" className="ml-2 text-xs h-5">Nova</Badge>
                )}
              </Button>
              <Button
                variant={activeTab === 'chat' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('chat')}
                className="flex-1 h-10"
              >
                <Bot className="h-4 w-4 mr-2" />
                Chat com IA
                {chatHistory.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs h-5">{chatHistory.length}</Badge>
                )}
              </Button>
              <Button
                variant={activeTab === 'messages' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('messages')}
                className="flex-1 h-10"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Conversas
                <Badge variant="secondary" className="ml-2 text-xs h-5">{messages.length}</Badge>
              </Button>
            </div>

            {/* Tab Content */}
            <Card>
              <CardContent className="p-6">
                {activeTab === 'suggestion' && (
                  <div className="space-y-4">
                    {suggestion ? (
                      <div className="space-y-4">
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
                          <div className="flex gap-3">
                            <Button size="sm" variant="outline" onClick={handleCopySuggestion} className="h-9">
                              <Copy className="h-4 w-4 mr-2" />
                              Copiar
                            </Button>
                            <Button size="sm" variant="outline" onClick={handleEditAndSend} className="h-9">
                              Editar e Enviar
                            </Button>
                          </div>
                        )}
                      </div>
                    ) : suggestionLoading ? (
                      <div className="text-center py-8">
                        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-3">
                          <Bot className="h-4 w-4 animate-spin" />
                          Gerando sugestão da IA...
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div className="bg-primary h-2 rounded-full w-1/2 animate-pulse"></div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground mb-4">
                          Nenhuma sugestão gerada ainda
                        </p>
                        <Button 
                          onClick={generateSuggestion} 
                          disabled={suggestionLoading}
                          size="sm"
                          className="h-9"
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
                        className="w-full h-9"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        {suggestionLoading ? 'Gerando...' : 'Regenerar Sugestão'}
                      </Button>
                    )}
                  </div>
                )}

                {activeTab === 'chat' && (
                  <div className="flex flex-col h-[400px]">
                    {/* Chat Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/20 rounded-lg">
                      {chatHistory.length === 0 ? (
                        <div className="text-center py-8">
                          <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-2" />
                          <p className="text-sm text-muted-foreground">
                            Nenhuma conversa ainda. Faça uma pergunta à IA!
                          </p>
                        </div>
                      ) : (
                        <>
                          {chatHistory.map((chat) => (
                            <div key={chat.id} className="space-y-3">
                              {/* User Message */}
                              <div className="flex justify-end">
                                <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-3">
                                  <p className="text-sm leading-relaxed">{chat.mensagem}</p>
                                </div>
                              </div>
                              
                              {/* AI Response */}
                              <div className="flex justify-start">
                                <div className="max-w-[80%] bg-card border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                  <div className="flex items-center gap-2 mb-2">
                                    <Bot className="h-4 w-4 text-primary" />
                                    <span className="text-xs text-muted-foreground font-medium">Assistente IA</span>
                                    {chat.log?.rag_hits !== undefined && chat.log?.kb_hits !== undefined && (
                                      <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                        {(chat.log.rag_hits + chat.log.kb_hits)} docs
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm leading-relaxed text-foreground">{chat.resposta}</p>
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {/* Loading Indicator */}
                          {chatLoading && (
                            <div className="flex justify-start">
                              <div className="max-w-[80%] bg-card border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                  <Bot className="h-4 w-4 text-primary" />
                                  <span className="text-xs text-muted-foreground font-medium">Assistente IA</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                  <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce"></div>
                                </div>
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* Input Area */}
                    <div className="border-t bg-background p-4 rounded-b-lg">
                      <div className="flex gap-3">
                        <Input
                          placeholder="Digite sua mensagem..."
                          value={aiQuestion}
                          onChange={(e) => setAiQuestion(e.target.value)}
                          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleAskAI())}
                          className="flex-1 h-10"
                          disabled={chatLoading}
                        />
                        <Button 
                          onClick={handleAskAI}
                          disabled={!aiQuestion.trim() || chatLoading}
                          size="icon"
                          className="h-10 w-10 shrink-0"
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'messages' && (
                  <div className="space-y-4">
                    <div className="max-h-60 overflow-y-auto space-y-3 p-2">
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
                        className="text-sm resize-none"
                      />
                      <div className="flex justify-between items-center gap-3">
                        <Button variant="outline" size="sm" className="h-10 px-4">
                          <Paperclip className="h-4 w-4 mr-2" />
                          Anexar
                        </Button>
                        <div className="flex gap-3">
                          <Button 
                            size="sm" 
                            onClick={handleSendMessage}
                            disabled={!newMessage.trim()}
                            className="h-10 px-6"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            Enviar
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={handleSendToFranqueado}
                            disabled={!newMessage.trim() || isSendingToFranqueado || !ticket?.franqueado_id}
                            title={!ticket?.franqueado_id ? 'Nenhum franqueado vinculado a este ticket' : ''}
                            className="h-10 px-4"
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            {isSendingToFranqueado ? 'Enviando...' : 'WhatsApp'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
};