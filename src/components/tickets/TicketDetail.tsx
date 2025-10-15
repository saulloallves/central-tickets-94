import { useState, useEffect } from 'react';
import { X, Clock, User, Building, Tag, AlertTriangle, MessageSquare, Send, Paperclip, Zap, Sparkles, Copy, Bot, Phone, Users, FileText, Settings, Play, Check, ExternalLink, Image, Video, File, Download, ChevronDown, RotateCcw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useTicketMessages } from '@/hooks/useTickets';
import { useAISuggestion } from '@/hooks/useAISuggestion';
import { useResponseProcessor } from '@/hooks/useResponseProcessor';
import { useAuth } from '@/hooks/useAuth';
import { useRole } from '@/hooks/useRole';
import { useOptimisticTicketActions } from '@/hooks/useOptimisticTicketActions';
import { ImageModal } from '@/components/ui/image-modal';
import { SLATimerDetail } from './SLATimerDetail';

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
  const [activeTab, setActiveTab] = useState<'chat' | 'detalhes'>('chat');
  const [isSendingToFranqueado, setIsSendingToFranqueado] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
  const [isFormatted, setIsFormatted] = useState(false);
  const [originalMessage, setOriginalMessage] = useState('');
  
  const { messages, sendMessage, loading: messagesLoading, refetch: refetchMessages } = useTicketMessages(ticketId);
  const { suggestion, loading: suggestionLoading, generateSuggestion, markSuggestionUsed } = useAISuggestion(ticketId);
  const { processResponse, isProcessing: responseProcessing } = useResponseProcessor();
  const { user } = useAuth();
  const { loading: isLoadingRole } = useRole();
  const { optimisticStartAttendance, isTicketPending } = useOptimisticTicketActions();
  
  const { toast } = useToast();

  const fetchTicketDetails = async () => {
    try {
      // Fetch ticket first using maybeSingle to avoid RLS issues
      const { data: ticketData, error: ticketError } = await supabase
        .from('tickets')
        .select('*')
        .eq('id', ticketId)
        .maybeSingle();

      if (ticketError) {
        console.error('Error fetching ticket:', ticketError);
        toast({
          title: "Erro ao carregar ticket",
          description: "Não foi possível carregar os detalhes do ticket. Tente novamente.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (!ticketData) {
        console.error('Ticket not found or no permission:', ticketId);
        toast({
          title: "Ticket não encontrado",
          description: "O ticket não existe ou você não tem permissão para visualizá-lo.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Fetch related data separately to avoid RLS issues
      const [unidadeRes, colaboradorRes, franqueadoRes, profileRes, equipeRes, atendimentoIniciadoRes] = await Promise.all([
        supabase.from('unidades').select('grupo, id').eq('id', ticketData.unidade_id).maybeSingle(),
        ticketData.colaborador_id ? supabase.from('colaboradores').select('nome_completo').eq('id', ticketData.colaborador_id).maybeSingle() : Promise.resolve({ data: null }),
        ticketData.franqueado_id ? supabase.from('franqueados').select('name').eq('id', String(ticketData.franqueado_id)).maybeSingle() : Promise.resolve({ data: null }),
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

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const validFiles = files.filter(file => {
      // Limit file size to 16MB
      if (file.size > 16 * 1024 * 1024) {
        toast({
          title: "Arquivo muito grande",
          description: `${file.name} excede o limite de 16MB`,
          variant: "destructive"
        });
        return false;
      }
      return true;
    });
    
    setAttachments(prev => [...prev, ...validFiles]);
    // Reset the input
    event.target.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const uploadAttachments = async (files: File[]) => {
    const uploadedFiles = [];
    
    for (const file of files) {
      // Sanitize filename - remove special characters and spaces
      const sanitizedName = file.name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove accents
        .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
        .replace(/_{2,}/g, '_') // Replace multiple underscores with single
        .toLowerCase();
      
      const fileName = `${Date.now()}-${sanitizedName}`;
      const { data, error } = await supabase.storage
        .from('ticket-attachments')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Error uploading file:', error);
        throw new Error(`Erro ao fazer upload de ${file.name}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('ticket-attachments')
        .getPublicUrl(data.path);

      uploadedFiles.push({
        url: publicUrlData.publicUrl,
        type: file.type,
        name: file.name,
        size: file.size,
        caption: file.name
      });
    }

    return uploadedFiles;
  };

  const sendAttachments = async (attachmentData: any[]) => {
    try {
      console.log('🚀 Calling zapi-send-media with:', { ticketId, attachments: attachmentData });
      
      const { data, error } = await supabase.functions.invoke('zapi-send-media', {
        body: {
          ticketId: ticketId,
          attachments: attachmentData
        }
      });

      if (error) {
        console.error('❌ Error from zapi-send-media:', error);
        throw error;
      }

      console.log('✅ zapi-send-media response:', data);
      
      if (data.failed > 0) {
        toast({
          title: "Alguns anexos falharam",
          description: `${data.sent} enviados, ${data.failed} falharam`,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Anexos enviados",
          description: `${data.sent} arquivo(s) enviado(s) via WhatsApp`,
        });
      }
      
      return data;
    } catch (error) {
      console.error('❌ Error sending attachments:', error);
      toast({
        title: "Erro ao enviar anexos",
        description: "Falha ao enviar anexos via WhatsApp",
        variant: "destructive"
      });
      throw error;
    }
  };

  const handleFormatMessage = async () => {
    if (!newMessage.trim()) {
      toast({
        title: "Campo vazio",
        description: "Digite uma mensagem antes de formatar",
        variant: "destructive"
      });
      return;
    }
    
    setOriginalMessage(newMessage);
    setIsUploadingAttachments(true);
    
    try {
      console.log('🤖 Iniciando formatação:', newMessage);
      const { data: userData } = await supabase.auth.getUser();
      const processed = await processResponse(newMessage, ticketId, userData.user?.id || '');
      
      if (processed?.respostaFinal) {
        console.log('✅ Mensagem formatada:', processed.respostaFinal);
        setNewMessage(processed.respostaFinal);
        setIsFormatted(true);
        
        toast({
          title: "✨ Mensagem formatada",
          description: "Revise e edite se necessário antes de enviar",
        });
      }
    } catch (error) {
      console.error('Erro ao formatar:', error);
      toast({
        title: "Erro na formatação",
        description: "Não foi possível formatar a mensagem",
        variant: "destructive"
      });
    } finally {
      setIsUploadingAttachments(false);
    }
  };

  const handleRestoreOriginal = () => {
    if (originalMessage) {
      setNewMessage(originalMessage);
      setIsFormatted(false);
      toast({
        title: "Mensagem restaurada",
        description: "Versão original restaurada",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() && attachments.length === 0) return;

    setIsUploadingAttachments(true);
    
    try {
      let uploadedAttachments = [];
      
      if (attachments.length > 0) {
        console.log('📎 Uploading attachments:', attachments.length);
        uploadedAttachments = await uploadAttachments(attachments);
        console.log('✅ Uploaded attachments:', uploadedAttachments);
      }

      const finalMessage = newMessage.trim() || '';

      console.log('💬 Sending message to database:', { finalMessage, attachments: uploadedAttachments });
      const success = await sendMessage(finalMessage, uploadedAttachments);
      
      if (success) {
        if (uploadedAttachments.length > 0) {
          console.log('📱 Sending attachments via Z-API:', uploadedAttachments);
          await sendAttachments(uploadedAttachments);
        }

        setNewMessage('');
        setAttachments([]);
        setIsFormatted(false);
        setOriginalMessage('');
        
        setTimeout(() => {
          refetchMessages();
        }, 500);
        
        toast({
          title: "Sucesso",
          description: uploadedAttachments.length > 0 
            ? `Mensagem e ${uploadedAttachments.length} anexo(s) enviados`
            : "Mensagem enviada",
        });
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem",
        variant: "destructive"
      });
    } finally {
      setIsUploadingAttachments(false);
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
    setActiveTab('chat'); // Muda para a aba Chat para enviar
  };

  const handleSendSuggestion = async (text: string) => {
    const success = await sendMessage(text);
    if (success && suggestion) {
      await markSuggestionUsed(suggestion.id, text);
      setNewMessage('');
      setEditedSuggestion('');
    }
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
      // Enviar mensagem diretamente para o grupo via Z-API
      const { data: zapiResult, error: zapiError } = await supabase.functions.invoke('send-ticket-notification', {
        body: {
          ticket_id: ticketId,
          template_key: 'resposta_ticket',
          resposta_real: newMessage
        }
      });

      if (zapiError) {
        console.error('❌ Erro ao enviar mensagem via Z-API:', zapiError);
        toast({
          title: "Erro no envio",
          description: "Erro ao enviar mensagem para o WhatsApp",
          variant: "destructive",
        });
        return;
      }

      console.log('✅ Mensagem enviada via Z-API:', zapiResult);

      // Salvar mensagem no histórico do ticket como saída
      const success = await sendMessage(newMessage);
      
      if (success) {
        setNewMessage('');
        toast({
          title: "✅ Mensagem enviada com sucesso!",
          description: "Mensagem enviada para o WhatsApp.",
        });
      }

    } catch (error) {
      console.error('Error sending to franqueado:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar mensagem para franqueado",
        variant: "destructive"
      });
    } finally {
      setIsSendingToFranqueado(false);
    }
  };

  const handleTeamChange = async (equipeId: string) => {
    try {
      // Verificar se usuário pertence à nova equipe
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data: userEquipesData } = await supabase
        .from('user_equipes' as any)
        .select('equipe_id')
        .eq('user_id', userId);

      const userEquipeIds = (userEquipesData as any[])?.map((ue: any) => ue.equipe_id) || [];
      const userWillLoseAccess = !userEquipeIds.includes(equipeId);

      // Use edge function to bypass RLS and trigger issues
      const { data, error } = await supabase.functions.invoke('update-ticket', {
        body: { 
          ticketId,
          updates: {
            equipe_responsavel_id: equipeId || null
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Emitir evento de transferência para o hook
      window.dispatchEvent(new CustomEvent('ticket-transferred', {
        detail: { ticketId, newEquipeId: equipeId }
      }));

      toast({
        title: "Sucesso",
        description: "Ticket transferido com sucesso",
      });

      // Se usuário não tem acesso à nova equipe, fechar modal
      if (userWillLoseAccess) {
        console.log('🚪 Usuário perdeu acesso ao ticket. Fechando modal...');
        onClose();
      } else {
        // Se ainda tem acesso, atualizar estado local
        setTicket(prev => ({
          ...prev,
          equipe_responsavel_id: equipeId || null,
          equipes: equipes.find(e => e.id === equipeId) || null,
          updated_at: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar equipe responsável",
        variant: "destructive"
      });
    }
  };

  const handleSLAChange = async (newSLADate: string) => {
    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          data_limite_sla: newSLADate,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) {
        throw error;
      }

      // Update local ticket state immediately
      setTicket(prev => ({
        ...prev,
        data_limite_sla: newSLADate,
        updated_at: new Date().toISOString()
      }));

      toast({
        title: "Sucesso",
        description: "Prazo do SLA atualizado",
      });

      // Refresh ticket details to get latest data
      fetchTicketDetails();
    } catch (error) {
      console.error('Error updating SLA:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar prazo do SLA",
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
      case 'alto': return 'outline';
      case 'medio': return 'secondary';
      case 'baixo': return 'secondary';
      default: return 'secondary';
    }
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

  

  const handleStartAttendance = async () => {
    if (!ticket || isTicketPending(ticketId)) return;

    // Dispatch optimistic update event to sync with Kanban
    const optimisticUpdate = (ticketId: string, updates: Partial<any>) => {
      // Update local state
      setTicket(prev => prev ? { ...prev, ...updates } : prev);
      
      // Dispatch event for Kanban synchronization
      window.dispatchEvent(new CustomEvent('ticket-optimistic-update', {
        detail: { ticketId, updates }
      }));
    };

    const rollback = (ticketId: string, originalStatus: string) => {
      setTicket(prev => prev ? { ...prev, status: originalStatus } : prev);
      
      // Dispatch rollback event
      window.dispatchEvent(new CustomEvent('ticket-optimistic-rollback', {
        detail: { ticketId, originalStatus }
      }));
    };

    await optimisticStartAttendance(
      ticketId,
      ticket.equipe_responsavel_id || '',
      ticket,
      optimisticUpdate,
      rollback
    );
  };

  const handleStatusChange = async (newStatus: 'aberto' | 'em_atendimento' | 'escalonado' | 'concluido') => {
    if (!ticket || isTicketPending(ticketId)) return;

    try {
      // Optimistic update
      const originalStatus = ticket.status;
      setTicket(prev => prev ? { ...prev, status: newStatus } : prev);
      
      // Dispatch event for Kanban synchronization
      window.dispatchEvent(new CustomEvent('ticket-optimistic-update', {
        detail: { ticketId, updates: { status: newStatus } }
      }));

      const { error } = await supabase
        .from('tickets')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) {
        // Rollback on error
        setTicket(prev => prev ? { ...prev, status: originalStatus } : prev);
        window.dispatchEvent(new CustomEvent('ticket-optimistic-rollback', {
          detail: { ticketId, originalStatus }
        }));
        throw error;
      }

      toast({
        title: "Status Atualizado",
        description: `Status alterado para '${newStatus}'`,
      });

    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar status",
        variant: "destructive"
      });
    }
  };

  const handleEquipeChange = async (equipeId: string) => {
    try {
      // Verificar se usuário pertence à nova equipe
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;

      const { data: userEquipesData } = await supabase
        .from('user_equipes' as any)
        .select('equipe_id')
        .eq('user_id', userId);

      const userEquipeIds = (userEquipesData as any[])?.map((ue: any) => ue.equipe_id) || [];
      const userWillLoseAccess = !userEquipeIds.includes(equipeId);

      // Usar edge function com service role para contornar RLS
      const { data, error } = await supabase.functions.invoke('update-ticket', {
        body: {
          ticketId,
          updates: {
            equipe_responsavel_id: equipeId || null
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      // Emitir evento de transferência para o hook
      window.dispatchEvent(new CustomEvent('ticket-transferred', {
        detail: { ticketId, newEquipeId: equipeId }
      }));

      toast({
        title: "Equipe Atualizada",
        description: "Ticket transferido com sucesso",
      });

      // Se usuário não tem acesso à nova equipe, fechar modal
      if (userWillLoseAccess) {
        console.log('🚪 Usuário perdeu acesso ao ticket. Fechando modal...');
        onClose();
      } else {
        // Se ainda tem acesso, atualizar estado local
        setTicket(prev => ({
          ...prev,
          equipe_responsavel_id: equipeId || null,
          equipes: equipes.find(e => e.id === equipeId) || null
        }));
      }
    } catch (error) {
      console.error('Error updating team:', error);
      toast({
        title: "Erro",
        description: "Erro ao atualizar equipe",
        variant: "destructive"
      });
    }
  };

  const handleResolveTicket = async () => {
    if (!ticket || isTicketPending(ticketId)) return;

    try {
      // Optimistic update first
      const originalStatus = ticket.status;
      const originalResolvido = ticket.resolvido_em;
      const newResolvidoEm = new Date().toISOString();
      
      setTicket(prev => prev ? { 
        ...prev, 
        status: 'concluido',
        resolvido_em: newResolvidoEm,
        updated_at: new Date().toISOString()
      } : prev);

      // Dispatch event for Kanban synchronization
      window.dispatchEvent(new CustomEvent('ticket-optimistic-update', {
        detail: { 
          ticketId, 
          updates: { 
            status: 'concluido',
            resolvido_em: newResolvidoEm
          } 
        }
      }));

      const { error } = await supabase
        .from('tickets')
        .update({ 
          status: 'concluido',
          resolvido_em: newResolvidoEm,
          updated_at: new Date().toISOString()
        })
        .eq('id', ticketId);

      if (error) {
        // Rollback on error
        setTicket(prev => prev ? { 
          ...prev, 
          status: originalStatus,
          resolvido_em: originalResolvido
        } : prev);
        window.dispatchEvent(new CustomEvent('ticket-optimistic-rollback', {
          detail: { ticketId, originalStatus }
        }));
        throw error;
      }

      toast({
        title: "Ticket Concluído",
        description: "Ticket marcado como concluído",
      });

    } catch (error) {
      console.error('Error resolving ticket:', error);
      toast({
        title: "Erro",
        description: "Erro ao concluir ticket",
        variant: "destructive"
      });
    }
  };

  // Se o ticket está aberto, mostra versão simplificada
  if (ticket.status === 'aberto') {
    return (
      <div className="w-full h-full flex flex-col overflow-hidden">
        {/* Header compacto */}
        <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 p-4">
          <div className="space-y-2">
            <h2 className="text-lg font-bold text-foreground line-clamp-2">
              {getTicketDisplayTitle(ticket)}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="font-mono text-xs bg-muted/50">
                {ticket.codigo_ticket}
              </Badge>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-xs text-muted-foreground font-medium">Aguardando Atendimento</span>
              </div>
            </div>
            {/* SLA Timer */}
            <SLATimerDetail
              ticketId={ticket.id}
              codigoTicket={ticket.codigo_ticket}
              dataAbertura={ticket.data_abertura}
              slaMinutosRestantes={ticket.sla_minutos_restantes}
              slaMinutosTotais={ticket.sla_minutos_totais}
              tempoPausadoTotal={ticket.tempo_pausado_total ? Math.floor((new Date(ticket.tempo_pausado_total).getTime() - new Date(0).getTime()) / 60000) : 0}
              status={ticket.status}
              slaPausado={ticket.sla_pausado || false}
              slaPausadoMensagem={ticket.sla_pausado_mensagem || false}
              slaPausadoHorario={ticket.sla_pausado_horario || false}
            />
          </div>
        </div>

        {/* Content unificado */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {/* Grid de informações - layout mais compacto */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border border-border/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500/10 border border-blue-500/20 rounded-md">
                    <Building className="h-3 w-3 text-blue-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Unidade</p>
                    <p className="font-medium text-sm truncate">
                      {ticket.unidades?.grupo || ticket.unidade_id}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border border-border/50 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-green-500/10 border border-green-500/20 rounded-md">
                    <User className="h-3 w-3 text-green-600" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground">Solicitante</p>
                    <p className="font-medium text-sm truncate">
                      {ticket.colaboradores?.nome_completo || 
                       ticket.profiles?.nome_completo || 
                       (ticket.franqueado_id ? (ticket.franqueados?.name || "Franqueado") : "Sistema")}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Equipe Responsável - compacto */}
            <div className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border border-border/50 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-md">
                  <Users className="h-3 w-3 text-purple-600" />
                </div>
                <p className="font-medium text-sm">Equipe Responsável</p>
              </div>
              <Select
                value={ticket.equipe_responsavel_id || "none"}
                onValueChange={(value) => handleTeamChange(value === "none" ? "" : value)}
              >
                <SelectTrigger className="w-full bg-background/50 border-border/40 h-8 text-sm">
                  <SelectValue placeholder="Selecionar equipe..." />
                </SelectTrigger>
                <SelectContent className="bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border border-border shadow-lg z-[60]">
                  <SelectItem value="none">Nenhuma equipe</SelectItem>
                  {equipes.map((equipe) => (
                    <SelectItem key={equipe.id} value={equipe.id}>
                      {equipe.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Descrição do problema - compacto */}
            <div className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border border-border/50 rounded-lg p-3">
              <h4 className="font-medium text-sm mb-2">Descrição do Problema</h4>
              <div className="p-3 bg-muted/30 rounded-md border border-primary/20">
                <p className="text-xs leading-relaxed text-foreground">
                  {ticket.descricao_problema}
                </p>
              </div>
            </div>

            {/* Botão de ação - integrado */}
            <div className="bg-gradient-to-br from-primary/5 to-secondary/5 backdrop-blur supports-[backdrop-filter]:bg-background/60 border border-border/40 rounded-lg p-4 text-center">
              <div className="mb-3">
                <h3 className="text-base font-semibold text-foreground mb-1">Pronto para Atender?</h3>
                <p className="text-xs text-muted-foreground">
                  Clique no botão abaixo para iniciar o atendimento deste ticket
                </p>
              </div>
              <Button 
                onClick={handleStartAttendance}
                size="sm"
                className="px-6 py-2 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <User className="h-4 w-4 mr-2" />
                Iniciar Atendimento
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {/* Header com Glass Effect */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border/40 p-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl line-clamp-2 mb-3 font-bold text-foreground">
              {getTicketDisplayTitle(ticket)}
            </h2>
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="outline" className="font-mono text-sm bg-muted/50">
                {ticket.codigo_ticket}
              </Badge>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(ticket.status)}`} />
                <span className="text-sm text-muted-foreground capitalize font-medium">{ticket.status}</span>
              </div>
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
          </div>
        </div>
        
        {/* SLA Timer */}
        <div className="pt-2">
          <SLATimerDetail
            ticketId={ticket.id}
            codigoTicket={ticket.codigo_ticket}
            dataAbertura={ticket.data_abertura}
            slaMinutosRestantes={ticket.sla_minutos_restantes}
            slaMinutosTotais={ticket.sla_minutos_totais}
            tempoPausadoTotal={ticket.tempo_pausado_total ? Math.floor((new Date(ticket.tempo_pausado_total).getTime() - new Date(0).getTime()) / 60000) : 0}
            status={ticket.status}
            slaPausado={ticket.sla_pausado || false}
            slaPausadoMensagem={ticket.sla_pausado_mensagem || false}
            slaPausadoHorario={ticket.sla_pausado_horario || false}
          />
        </div>
      </div>

      {/* Content - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Tab Navigation */}
        <div className="px-6 pt-4 pb-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'chat' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('chat')}
              className="flex-1 h-10"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
              <Badge variant="secondary" className="ml-2 text-xs h-5">{messages.length}</Badge>
            </Button>
            <Button
              variant={activeTab === 'detalhes' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('detalhes')}
              className="flex-1 h-10"
            >
              <FileText className="h-4 w-4 mr-2" />
              Detalhes
            </Button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'chat' && (
            <div className="flex flex-col gap-4 min-h-[700px]">
                {/* Sugestão IA Section - COLLAPSIBLE */}
                <Collapsible open={isSuggestionOpen} onOpenChange={setIsSuggestionOpen}>
                  <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50">
                    <CollapsibleTrigger asChild>
                      <CardHeader className="pb-3 cursor-pointer hover:bg-muted/50 transition-colors flex flex-row items-center justify-between space-y-0 py-4">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Bot className="h-4 w-4" />
                          Sugestão IA
                          <ChevronDown 
                            className={`h-4 w-4 transition-transform duration-200 ${
                              isSuggestionOpen ? 'transform rotate-180' : ''
                            }`} 
                          />
                        </CardTitle>
                        {isSuggestionOpen && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={(e) => {
                              e.stopPropagation();
                              generateSuggestion();
                            }}
                            disabled={suggestionLoading}
                            className="h-8"
                          >
                            {suggestionLoading ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            ) : (
                              <Zap className="h-4 w-4" />
                            )}
                            {suggestionLoading ? 'Gerando...' : 'Gerar'}
                          </Button>
                        )}
                      </CardHeader>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                      <CardContent>
                        {suggestion ? (
                          <div className="space-y-4">
                            <div className="p-4 bg-muted/30 rounded-lg border border-primary/20">
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
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-primary/50 rounded-full animate-pulse" style={{width: '60%'}}></div>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-8">
                            <Bot className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                            <p className="text-sm text-muted-foreground mb-4">
                              Gere uma sugestão de resposta baseada no contexto do ticket
                            </p>
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={generateSuggestion}
                              className="h-9"
                            >
                              <Zap className="h-4 w-4 mr-2" />
                              Gerar Sugestão
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>

              {/* Messages Section */}
              <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    Conversas ({messages.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-[500px] overflow-y-auto">
                    {messages.length === 0 ? (
                      <div className="text-center py-8">
                        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                        <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda</p>
                      </div>
                    ) : (
          messages.map((message) => {
            // Extrair nome do profile (pode vir como objeto ou array)
            let profileName: string | null = null;
            if (message.profiles) {
              if (Array.isArray(message.profiles) && message.profiles.length > 0) {
                profileName = message.profiles[0]?.nome_completo || null;
              } else if (typeof message.profiles === 'object') {
                profileName = (message.profiles as any).nome_completo || null;
              }
            }

            // Franqueado: mensagens de ENTRADA sem usuario_id (vindas de fora do sistema)
            const isFranqueado = message.direcao === 'entrada' && !message.usuario_id;
            
            // Suporte: mensagens de SAÍDA com usuario_id E com nome no profile
            const isSuporte = message.direcao === 'saida' && !!message.usuario_id && !!profileName;
            
            // Sistema: mensagens sem identificação clara
            const isSystem = !isFranqueado && !isSuporte;
            
            // Nome a exibir
            const displayName = isFranqueado 
              ? (ticket.franqueados?.name || 'Franqueado')
              : isSuporte 
                ? profileName 
                : 'Sistema';
                        
                        return (
                          <div key={message.id} className="flex gap-3 p-3 bg-muted/20 rounded-lg">
                            <div className={`p-2 rounded-full shrink-0 ${
                              isFranqueado 
                                ? 'bg-orange-500/10 border border-orange-500/20' 
                                : isSuporte 
                                  ? 'bg-blue-500/10 border border-blue-500/20'
                                  : 'bg-gray-500/10 border border-gray-500/20'
                            }`}>
                              <User className={`h-4 w-4 ${
                                isFranqueado 
                                  ? 'text-orange-600' 
                                  : isSuporte 
                                    ? 'text-blue-600'
                                    : 'text-gray-600'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className={`text-sm font-medium ${
                                  isFranqueado 
                                    ? 'text-orange-600' 
                                    : isSuporte 
                                      ? 'text-blue-600'
                                      : 'text-gray-600'
                                }`}>
                                  {displayName}
                                </span>
                                
                                {/* Badge identificador */}
                                {isFranqueado && (
                                  <Badge variant="outline" className="text-xs bg-orange-100 text-orange-700 border-orange-300">
                                    Franqueado
                                  </Badge>
                                )}
                                {isSuporte && (
                                  <Badge variant="outline" className="text-xs bg-blue-100 text-blue-700 border-blue-300">
                                    Suporte
                                  </Badge>
                                )}
                                {isSystem && (
                                  <Badge variant="outline" className="text-xs bg-gray-100 text-gray-700 border-gray-300">
                                    Sistema
                                  </Badge>
                                )}
                                
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNowInSaoPaulo(message.created_at)}
                                </span>
                              </div>
                               <p className="text-sm text-muted-foreground break-words">
                                 {message.mensagem}
                               </p>
                               
                               {/* Render attachments */}
                               {message.anexos && Array.isArray(message.anexos) && message.anexos.length > 0 && (
                                 <div className="mt-2 space-y-2">
                                   {message.anexos.map((attachment: any, idx: number) => (
                                     <div key={idx} className="flex items-center gap-2 p-2 bg-background/50 rounded border">
                        {(attachment.tipo === 'imagem' || attachment.type?.startsWith('image/')) ? (
                          <ImageModal 
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
                                       ) : attachment.type?.startsWith('video/') ? (
                                         <div className="flex items-center gap-2">
                                           <Video className="h-4 w-4 text-blue-600" />
                                           <video 
                                             controls 
                                             className="max-w-32 max-h-32 rounded"
                                             src={attachment.url}
                                           />
                                           <span className="text-xs text-muted-foreground">{attachment.name}</span>
                                         </div>
                                       ) : attachment.type?.startsWith('audio/') ? (
                                         <div className="flex items-center gap-2">
                                           <Play className="h-4 w-4 text-purple-600" />
                                           <audio controls className="max-w-48">
                                             <source src={attachment.url} type={attachment.type} />
                                           </audio>
                                           <span className="text-xs text-muted-foreground">{attachment.name}</span>
                                         </div>
                                       ) : (
                                         <div className="flex items-center gap-2">
                                           <File className="h-4 w-4 text-gray-600" />
                                           <a 
                                             href={attachment.url} 
                                             target="_blank" 
                                             rel="noopener noreferrer"
                                             className="text-xs text-primary hover:underline"
                                           >
                                             {attachment.name}
                                           </a>
                                           <Button size="sm" variant="ghost" asChild>
                                             <a href={attachment.url} download>
                                               <Download className="h-3 w-3" />
                                             </a>
                                           </Button>
                                         </div>
                                       )}
                                     </div>
                                   ))}
                                 </div>
                               )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Send Message Form */}
                  <div className="mt-4 pt-4 border-t">
                    {/* Attachment previews */}
                    {attachments.length > 0 && (
                      <div className="mb-3 p-3 bg-muted/20 rounded-lg border">
                        <div className="flex items-center gap-2 mb-2">
                          <Paperclip className="h-4 w-4" />
                          <span className="text-sm font-medium">{attachments.length} arquivo(s) selecionado(s)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          {attachments.map((file, index) => (
                            <div key={index} className="flex items-center gap-2 p-2 bg-background rounded border">
                              {file.type.startsWith('image/') ? (
                                <Image className="h-4 w-4 text-green-600" />
                              ) : file.type.startsWith('video/') ? (
                                <Video className="h-4 w-4 text-blue-600" />
                              ) : (
                                <File className="h-4 w-4 text-gray-600" />
                              )}
                              <span className="text-xs truncate flex-1">{file.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {(file.size / 1024).toFixed(1)}KB
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => removeAttachment(index)}
                                className="h-6 w-6 p-0"
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Badge indicador de mensagem formatada */}
                    {isFormatted && (
                      <div className="mb-2">
                        <Badge variant="secondary" className="text-xs">
                          <Sparkles className="h-3 w-3 mr-1" />
                          Mensagem formatada pela IA
                        </Badge>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Digite sua mensagem..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (isFormatted) {
                              handleSendMessage();
                            } else {
                              handleFormatMessage();
                            }
                          }
                        }}
                        className="flex-1 min-h-[60px] resize-none"
                        disabled={messagesLoading || isUploadingAttachments}
                      />
                      
                      {!isFormatted ? (
                        <Button
                          onClick={handleFormatMessage}
                          disabled={!newMessage.trim() || isUploadingAttachments}
                          size="icon"
                          title="Formatar mensagem com IA"
                          className="h-10 w-10 shrink-0"
                        >
                          {isUploadingAttachments ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </Button>
                      ) : (
                        <>
                          <Button
                            onClick={handleRestoreOriginal}
                            variant="outline"
                            size="icon"
                            title="Restaurar mensagem original"
                            className="h-10 w-10 shrink-0"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          
                          <Button
                            onClick={handleSendMessage}
                            disabled={isUploadingAttachments}
                            size="icon"
                            title="Enviar mensagem"
                            className="h-10 w-10 shrink-0"
                          >
                            {isUploadingAttachments ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {activeTab === 'detalhes' && (
            <div className="space-y-6">
              {/* Info Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Unidade Card */}
                <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50 hover:bg-card/70">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-lg">
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
                <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50 hover:bg-card/70">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-green-500/10 border border-green-500/20 rounded-lg">
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
                <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50 hover:bg-card/70">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-lg">
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

              {/* Temporal Info Card */}
              <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50 hover:bg-card/70">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground mb-1">Criado em</p>
                      <p className="font-semibold text-sm">
                        {ticket.created_at ? formatDateTimeBR(ticket.created_at) : 'N/A'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {ticket.created_at && formatDistanceToNowInSaoPaulo(ticket.created_at, { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Description Card */}
              <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Descrição do Problema
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                    {ticket.descricao_problema || 'Nenhuma descrição fornecida'}
                  </p>
                </CardContent>
              </Card>

              {/* Status e Equipe Controls */}
              <Card className="bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/30 border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Controles do Ticket
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status Control */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Status</Label>
                    <Select value={ticket.status} onValueChange={handleStatusChange}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aberto">Aberto</SelectItem>
                        <SelectItem value="em_atendimento">Em Atendimento</SelectItem>
                        <SelectItem value="escalonado">Escalonado</SelectItem>
                        <SelectItem value="concluido">Concluído</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Equipe Control */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Equipe Responsável</Label>
                    <Select value={ticket.equipe_responsavel_id || 'none'} onValueChange={(value) => handleEquipeChange(value === 'none' ? '' : value)}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecionar equipe" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma equipe</SelectItem>
                        {equipes.map((equipe) => (
                          <SelectItem key={equipe.id} value={equipe.id}>
                            {equipe.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* SLA Control */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Prazo do SLA</Label>
                    <Input
                      type="datetime-local"
                      value={ticket.data_limite_sla ? new Date(ticket.data_limite_sla).toISOString().slice(0, 16) : ''}
                      onChange={(e) => {
                        if (e.target.value) {
                          const newDate = new Date(e.target.value).toISOString();
                          handleSLAChange(newDate);
                        }
                      }}
                      className="h-9"
                    />
                    {ticket.data_limite_sla && (
                      <div className="text-xs text-muted-foreground">
                        Atual: {new Date(ticket.data_limite_sla).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {ticket.status === 'aberto' && (
                  <Button onClick={handleStartAttendance} className="flex-1">
                    <Play className="h-4 w-4 mr-2" />
                    Iniciar Atendimento
                  </Button>
                )}
                
                {ticket.status === 'em_atendimento' && (
                  <Button onClick={handleResolveTicket} className="flex-1" variant="outline">
                    <Check className="h-4 w-4 mr-2" />
                    Concluir Ticket
                  </Button>
                )}

                <TicketActions ticket={ticket} equipes={equipes} />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};