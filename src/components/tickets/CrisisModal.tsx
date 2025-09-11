import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  AlertTriangle, 
  Clock, 
  Send, 
  MessageSquare, 
  Eye,
  Users,
  FileText,
  MessageCircle
} from "lucide-react";
import { TicketDetail } from "./TicketDetail";
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Crisis {
  id: string;
  titulo: string;
  status: string;
  created_at: string;
  equipe_id: string;
}

interface CrisisTicket {
  id: string;
  codigo_ticket: string;
  titulo: string;
  descricao_problema: string;
  status: string;
  prioridade: string;
  data_abertura: string;
  unidade_id: string;
  franqueado_id: string | number | null;
  unidades: any;
}

interface CrisisMessage {
  id: string;
  mensagem: string;
  total_grupos: number;
  created_at: string;
  enviado_por: string | null;
}

interface CrisisModalProps {
  crisis: Crisis;
  isOpen: boolean;
  onClose: () => void;
}

export function CrisisModal({ crisis, isOpen, onClose }: CrisisModalProps) {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<CrisisTicket[]>([]);
  const [messages, setMessages] = useState<CrisisMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [activeTab, setActiveTab] = useState('tickets');

  useEffect(() => {
    if (isOpen && crisis.id) {
      fetchCrisisTickets();
      fetchCrisisMessages();
    }
  }, [isOpen, crisis.id]);

  const fetchCrisisTickets = async () => {
    try {
      setLoading(true);
      console.log('Buscando tickets para crise:', crisis.id);

      const { data, error } = await supabase
        .from('crise_ticket_links')
        .select(`
          ticket_id,
          tickets (
            id,
            codigo_ticket,
            titulo,
            descricao_problema,
            status,
            prioridade,
            data_abertura,
            unidade_id,
            franqueado_id,
            unidades (grupo)
          )
        `)
        .eq('crise_id', crisis.id);

      if (error) {
        throw error;
      }

      console.log('Dados retornados:', data);

      const processedTickets: CrisisTicket[] = (data || [])
        .filter(item => item.tickets)
        .map(item => ({
          id: item.tickets.id,
          codigo_ticket: item.tickets.codigo_ticket,
          titulo: item.tickets.titulo,
          descricao_problema: item.tickets.descricao_problema,
          status: item.tickets.status,
          prioridade: item.tickets.prioridade,
          data_abertura: item.tickets.data_abertura,
          unidade_id: item.tickets.unidade_id,
          franqueado_id: item.tickets.franqueado_id,
          unidades: item.tickets.unidades || null
        }));

      console.log('Tickets processados:', processedTickets);
      setTickets(processedTickets);
    } catch (error) {
      console.error('Erro ao buscar tickets da crise:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar tickets da crise",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchCrisisMessages = async () => {
    try {
      const { data, error } = await supabase
        .from('crise_mensagens')
        .select('*')
        .eq('crise_id', crisis.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar mensagens:', error);
        return;
      }

      setMessages(data || []);
    } catch (error) {
      console.error('Erro ao carregar mensagens da crise:', error);
    }
  };

  const handleResolveCrisis = async () => {
    try {
      setLoading(true);
      console.log('🔄 Iniciando resolução da crise:', crisis.id);

      // Obter o usuário autenticado primeiro
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError) {
        console.error('❌ Erro ao obter usuário:', userError);
        throw new Error('Erro de autenticação');
      }

      // Usar função database para resolver crise de forma transacional
      console.log('📝 Chamando função resolve_crise_close_tickets...');
      console.log('📋 Parâmetros:', {
        p_crise_id: crisis.id,
        p_mensagem: 'Crise resolvida através do painel administrativo',
        p_status_ticket: 'concluido',
        p_by: user?.id
      });
      
      const { data, error } = await supabase.rpc('resolve_crise_close_tickets', {
        p_crise_id: crisis.id,
        p_mensagem: 'Crise resolvida através do painel administrativo',
        p_status_ticket: 'concluido' as const,
        p_by: user?.id || null
      });

      console.log('📄 Resposta da função RPC:', { data, error });

      if (error) {
        console.error('❌ Erro ao resolver crise via RPC:', error);
        console.error('❌ Detalhes do erro:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw new Error(`Erro na função RPC: ${error.message}`);
      }
      
      console.log('✅ Crise resolvida com sucesso via RPC');

      toast({
        title: "Crise Resolvida",
        description: `Crise e ${tickets.length} tickets foram resolvidos com sucesso`,
      });

      console.log('🎉 Crise resolvida com sucesso, fechando modal');
      onClose();
    } catch (error: any) {
      console.error('❌ Erro geral ao resolver crise:', error);
      
      // Fallback para método manual se a função RPC falhar
      try {
        console.log('🔄 Tentando método manual de resolução...');
        
        // Atualizar status da crise manualmente
        const { error: crisisError } = await supabase
          .from('crises')
          .update({
            status: 'encerrado',
            is_active: false,
            resolved_at: new Date().toISOString()
          })
          .eq('id', crisis.id);

        if (crisisError) throw crisisError;

        // Resolver todos os tickets vinculados
        const ticketIds = tickets.map(t => t.id);
        if (ticketIds.length > 0) {
          const { error: ticketsError } = await supabase
            .from('tickets')
            .update({ status: 'concluido' })
            .in('id', ticketIds);

          if (ticketsError) throw ticketsError;
        }

        toast({
          title: "Crise Resolvida",
          description: `Crise e ${tickets.length} tickets foram resolvidos com sucesso (método manual)`,
        });

        onClose();
      } catch (fallbackError: any) {
        console.error('❌ Erro no método manual:', fallbackError);
        toast({
          title: "Erro",
          description: `Erro ao resolver crise: ${fallbackError?.message || 'Erro desconhecido'}`,
          variant: "destructive"
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleTicketClick = (ticketId: string) => {
    setSelectedTicketId(ticketId);
    setTicketModalOpen(true);
  };

  const handleCloseTicketDetail = () => {
    setTicketModalOpen(false);
    setSelectedTicketId(null);
  };

  const handleSendBroadcastMessage = async () => {
    if (!broadcastMessage.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma mensagem antes de enviar",
        variant: "destructive"
      });
      return;
    }

    setSendingMessage(true);
    try {
      const unidadeIds = [...new Set(tickets.map(t => t.unidade_id))];

      const { data: unidades, error: unidadesError } = await supabase
        .from('unidades')
        .select('id, id_grupo_branco, grupo')
        .in('id', unidadeIds)
        .not('id_grupo_branco', 'is', null);

      if (unidadesError) throw unidadesError;

      const grupos = unidades?.map(u => u.id_grupo_branco).filter(Boolean) || [];

      if (grupos.length === 0) {
        toast({
          title: "Aviso",
          description: "Nenhum grupo WhatsApp encontrado para as unidades desta crise",
          variant: "destructive"
        });
        return;
      }

      const { data: template, error: templateError } = await supabase
        .from('message_templates')
        .select('template_content')
        .eq('template_key', 'crisis')
        .eq('is_active', true)
        .maybeSingle();

      if (templateError) {
        console.error('Erro ao buscar template:', templateError);
      }

      let messageTemplate = template?.template_content || 
        `🚨 *CRISE ATIVA* 🚨\n\n🎫 *Ticket:* {{codigo_ticket}}\n🏢 *Unidade:* {{unidade_id}}\n\n💥 *Motivo:*\n{{motivo}}\n\n⏰ *Informado em:* {{timestamp}}\n\n_Mensagem enviada automaticamente pelo sistema de gerenciamento de crises_`;

      const firstTicket = tickets[0];
      const unidadeNome = unidades?.find(u => u.id === firstTicket?.unidade_id)?.grupo || 'N/A';
      
      const formattedMessage = messageTemplate
        .replace('{{codigo_ticket}}', firstTicket?.titulo || firstTicket?.codigo_ticket || 'N/A')
        .replace('{{unidade_id}}', unidadeNome)
        .replace('{{motivo}}', broadcastMessage)
        .replace('{{timestamp}}', new Date().toLocaleString('pt-BR'));

      const promises = grupos.map(async (grupo) => {
        const { error } = await supabase.functions.invoke('process-notifications', {
          body: {
            ticketId: null,
            type: 'crisis_broadcast',
            payload: {
              phone: grupo,
              message: formattedMessage,
              crise_id: crisis.id
            }
          }
        });

        if (error) {
          console.error('Erro ao enviar mensagem para grupo:', grupo, error);
          throw error;
        }
      });

      await Promise.all(promises);

      const { error: saveError } = await supabase
        .from('crise_mensagens')
        .insert({
          crise_id: crisis.id,
          mensagem: broadcastMessage,
          total_grupos: grupos.length,
          grupos_destinatarios: grupos
        });

      if (saveError) {
        console.error('Erro ao salvar mensagem:', saveError);
      }

      await fetchCrisisMessages();

      toast({
        title: "✅ Mensagem Enviada com Sucesso!",
        description: `Mensagem: "${broadcastMessage.substring(0, 50)}${broadcastMessage.length > 50 ? '...' : ''}" enviada para ${grupos.length} grupo(s) WhatsApp`,
        variant: "default"
      });

      setBroadcastMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem broadcast:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem para os grupos",
        variant: "destructive"
      });
    } finally {
      setSendingMessage(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'aberto':
        return 'destructive';
      case 'em_atendimento':
        return 'default';
      case 'aguardando':
        return 'secondary';
      case 'concluido':
        return 'outline';
      default:
        return 'outline';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'crise':
        return 'destructive';
      case 'imediato':
        return 'destructive';
      case 'urgente':
        return 'destructive';
      case 'alta':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl w-[90vw] h-[80vh] max-h-none flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0 border-b pb-4">
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Gerenciamento de Crise
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 mb-4 flex-shrink-0">
              <TabsTrigger value="tickets" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Tickets
                <Badge variant="outline">{tickets.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="detalhes" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Detalhes
              </TabsTrigger>
              <TabsTrigger value="mensagens" className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Mensagens
                <Badge variant="outline">{messages.length}</Badge>
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-hidden">
              <TabsContent value="tickets" className="h-full m-0">
                <ScrollArea className="h-full pr-4">
                  {loading ? (
                    <div className="flex items-center justify-center h-32">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tickets.map((ticket) => (
                        <Card key={ticket.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => handleTicketClick(ticket.id)}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                                <div className="flex flex-col min-w-0 flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <Badge variant={getPriorityColor(ticket.prioridade)} className="text-xs">
                                      {ticket.prioridade}
                                    </Badge>
                                    <Badge variant={getStatusColor(ticket.status)} className="text-xs">
                                      {ticket.status}
                                    </Badge>
                                  </div>
                                  <h4 className="font-medium text-sm truncate">{ticket.titulo}</h4>
                                  <p className="text-xs text-muted-foreground truncate">{ticket.descricao_problema}</p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {ticket.unidades?.grupo || 'Unidade não identificada'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Clock className="h-3 w-3" />
                                      {format(new Date(ticket.data_abertura), 'dd/MM HH:mm', { locale: ptBR })}
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTicketClick(ticket.id);
                                }}
                                className="flex-shrink-0"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="detalhes" className="h-full m-0">
                <ScrollArea className="h-full pr-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{crisis.titulo}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge variant="destructive">{crisis.status}</Badge>
                          <span className="text-sm text-muted-foreground">
                            Criada em: {format(new Date(crisis.created_at), 'dd/MM/yyyy \'às\' HH:mm', { locale: ptBR })}
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {tickets.length} ticket(s) relacionado(s)
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="mensagens" className="h-full m-0 space-y-4">
                <div className="h-full flex flex-col space-y-4">
                  {/* Formulário de envio de mensagem */}
                  <Card className="flex-shrink-0">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        Comunicação de Crise
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <Textarea
                        placeholder="Digite sua mensagem de comunicação de crise..."
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                        className="min-h-[80px] resize-none"
                      />
                      <Button 
                        onClick={handleSendBroadcastMessage}
                        disabled={!broadcastMessage.trim() || sendingMessage}
                        className="w-full"
                      >
                        {sendingMessage ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Enviando...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Enviar para Grupos WhatsApp
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Histórico de mensagens */}
                  {messages.length > 0 && (
                    <Card className="flex-1 overflow-hidden">
                      <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                          <MessageSquare className="h-4 w-4" />
                          Histórico de Mensagens ({messages.length})
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="h-full overflow-hidden">
                        <ScrollArea className="h-[200px]">
                          <div className="space-y-4">
                            {messages.map((message) => (
                              <div key={message.id} className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium flex-shrink-0">
                                  A
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium">Admin</span>
                                    <span className="text-xs text-muted-foreground">
                                      {format(new Date(message.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {message.total_grupos} grupo(s)
                                    </Badge>
                                  </div>
                                  <p className="text-sm break-words">{message.mensagem}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Footer com botões */}
        <div className="flex-shrink-0 flex items-center justify-between border-t pt-4">
          <p className="text-sm text-muted-foreground">
            Resolver esta crise irá marcar todos os tickets como concluídos
          </p>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              <span className="mr-2">✕</span>
              Fechar
            </Button>
            <Button 
              onClick={handleResolveCrisis} 
              disabled={loading}
              variant="destructive"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <span className="mr-2">✓</span>
              )}
              Resolver Crise
            </Button>
          </div>
        </div>

        {/* Modal de Detalhes do Ticket */}
        {selectedTicketId && ticketModalOpen && (
          <Dialog open={ticketModalOpen} onOpenChange={handleCloseTicketDetail}>
            <DialogContent className="max-w-5xl w-[90vw] h-[80vh] max-h-none">
              <DialogHeader className="sr-only">
                <DialogTitle>Detalhes do Ticket</DialogTitle>
                <DialogDescription>Visualização completa dos detalhes do ticket</DialogDescription>
              </DialogHeader>
              <TicketDetail
                ticketId={selectedTicketId}
                onClose={handleCloseTicketDetail}
              />
            </DialogContent>
          </Dialog>
        )}
      </DialogContent>
    </Dialog>
  );
}