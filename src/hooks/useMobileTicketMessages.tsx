import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

interface TicketMessage {
  id: string;
  ticket_id: string;
  mensagem: string;
  direcao: string;
  canal: string;
  created_at: string;
  usuario_id: string;
  anexos?: Array<{
    tipo?: string;
    type?: string;
    url: string;
    nome?: string;
    name?: string;
  }>;
}

export const useMobileTicketMessages = (ticketId: string) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<any>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_mensagens')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as any);
    } catch (error) {
      console.error('Erro ao buscar mensagens:', error);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  const sendMessage = useCallback(async (texto: string, senha_web: string, anexos?: any[]) => {
    if (!texto.trim() && (!anexos || anexos.length === 0)) return false;

    // Verificar se ticket está concluído
    const { data: ticketData } = await supabase
      .from('tickets')
      .select('status')
      .eq('id', ticketId)
      .single();

    if (ticketData?.status === 'concluido') {
      console.error('Tentativa de enviar mensagem em ticket concluído');
      return false;
    }

    setSending(true);
    try {
      // Call Edge Function to validate senha_web and send message
      const { data, error } = await supabase.functions.invoke('typebot-ticket-message', {
        body: {
          ticketId: ticketId,
          texto: texto,
          senha_web: senha_web,
          canal: 'typebot',
          autor: 'franqueado',
          anexos: anexos || []
        }
      });

      if (error) {
        console.error('Erro ao chamar edge function:', error);
        return false;
      }

      if (!data?.ok) {
        console.error('Edge function retornou erro:', data);
        return false;
      }
      
      // Realtime listener will handle adding the new message automatically
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return false;
    } finally {
      setSending(false);
    }
  }, [ticketId, fetchMessages]);

  // Setup polling (realtime não funciona sem autenticação)
  useEffect(() => {
    console.log('🔄 [MOBILE MESSAGES] Setting up polling for ticket:', ticketId);
    
    // Busca inicial
    fetchMessages();

    // Polling a cada 3 segundos
    const intervalId = setInterval(() => {
      console.log('🔄 [POLLING] Fetching messages...');
      fetchMessages();
    }, 3000);

    return () => {
      console.log('🧹 [POLLING] Cleanup - clearing interval');
      clearInterval(intervalId);
    };
  }, [ticketId, fetchMessages]);

  return {
    messages,
    loading,
    sending,
    sendMessage,
    refetch: fetchMessages
  };
};
