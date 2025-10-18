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

      if (error) throw error;
      
      await fetchMessages();
      return true;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      return false;
    } finally {
      setSending(false);
    }
  }, [ticketId, fetchMessages]);

  // Setup realtime
  useEffect(() => {
    fetchMessages();

    const channel = supabase
      .channel(`mobile-ticket-messages-${ticketId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ticket_mensagens',
          filter: `ticket_id=eq.${ticketId}`
        },
        (payload) => {
          console.log('📨 Message change:', payload.eventType);
          
          if (payload.eventType === 'INSERT') {
            setMessages(prev => [...prev, payload.new as TicketMessage]);
          } else if (payload.eventType === 'UPDATE') {
            setMessages(prev => prev.map(msg => 
              msg.id === payload.new.id ? payload.new as TicketMessage : msg
            ));
          } else if (payload.eventType === 'DELETE') {
            setMessages(prev => prev.filter(msg => msg.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
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
