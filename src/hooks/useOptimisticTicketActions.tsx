import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from './use-toast';
import { Ticket } from './useTickets';

export interface OptimisticAction {
  id: string;
  type: 'conclude' | 'start_attendance' | 'status_change';
  ticketId: string;
  originalStatus: string;
  targetStatus: string;
  timestamp: number;
}

export const useOptimisticTicketActions = () => {
  const [pendingActions, setPendingActions] = useState<OptimisticAction[]>([]);
  const { toast } = useToast();

  const addPendingAction = useCallback((action: OptimisticAction) => {
    setPendingActions(prev => [...prev, action]);
  }, []);

  const removePendingAction = useCallback((actionId: string) => {
    setPendingActions(prev => prev.filter(a => a.id !== actionId));
  }, []);

  const rollbackAction = useCallback((actionId: string, onRollback?: (ticketId: string, originalStatus: string) => void) => {
    const action = pendingActions.find(a => a.id === actionId);
    if (action && onRollback) {
      onRollback(action.ticketId, action.originalStatus);
    }
    removePendingAction(actionId);
  }, [pendingActions, removePendingAction]);

  // Optimistic conclude ticket
  const optimisticConcludeTicket = useCallback(async (
    ticketId: string,
    originalTicket: Ticket,
    onOptimisticUpdate: (ticketId: string, updates: Partial<Ticket>) => void,
    onRollback: (ticketId: string, originalStatus: string) => void
  ) => {
    const actionId = `conclude-${ticketId}-${Date.now()}`;
    const action: OptimisticAction = {
      id: actionId,
      type: 'conclude',
      ticketId,
      originalStatus: originalTicket.status,
      targetStatus: 'concluido',
      timestamp: Date.now()
    };

    try {
      // Step 1: Optimistic UI update
      addPendingAction(action);
      onOptimisticUpdate(ticketId, {
        status: 'concluido',
        resolvido_em: new Date().toISOString(),
      });

      // Step 2: Debounced button state (handled by caller)
      
      // Step 3: Backend update
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'concluido',
          resolvido_em: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (error) throw error;

      // Step 4: Success - remove pending action
      removePendingAction(actionId);
      
      toast({
        title: "✅ Ticket Concluído",
        description: "Ticket foi concluído com sucesso",
      });

    } catch (error) {
      console.error('Error concluding ticket:', error);
      
      // Step 5: Rollback on error
      rollbackAction(actionId, onRollback);
      
      toast({
        title: "❌ Erro ao Concluir",
        description: "Falha ao concluir o ticket. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [addPendingAction, removePendingAction, rollbackAction, toast]);

  // Optimistic start attendance
  const optimisticStartAttendance = useCallback(async (
    ticketId: string,
    equipeId: string,
    originalTicket: Ticket,
    onOptimisticUpdate: (ticketId: string, updates: Partial<Ticket>) => void,
    onRollback: (ticketId: string, originalStatus: string) => void
  ) => {
    const actionId = `start-${ticketId}-${Date.now()}`;
    const action: OptimisticAction = {
      id: actionId,
      type: 'start_attendance',
      ticketId,
      originalStatus: originalTicket.status,
      targetStatus: 'em_atendimento',
      timestamp: Date.now()
    };

    try {
      // Step 1: Optimistic UI update
      addPendingAction(action);
      onOptimisticUpdate(ticketId, {
        status: 'em_atendimento',
        equipe_responsavel_id: equipeId,
        atendimento_iniciado_em: new Date().toISOString(),
      });

      // Step 2: Backend update
      const { error } = await supabase
        .from('tickets')
        .update({
          status: 'em_atendimento',
          equipe_responsavel_id: equipeId,
          atendimento_iniciado_em: new Date().toISOString(),
        })
        .eq('id', ticketId);

      if (error) throw error;

      // Step 3: Success
      removePendingAction(actionId);
      
      toast({
        title: "🚀 Atendimento Iniciado",
        description: "Atendimento do ticket foi iniciado",
      });

    } catch (error) {
      console.error('Error starting attendance:', error);
      
      // Step 4: Rollback on error
      rollbackAction(actionId, onRollback);
      
      toast({
        title: "❌ Erro ao Iniciar Atendimento",
        description: "Falha ao iniciar atendimento. Tente novamente.",
        variant: "destructive",
      });
    }
  }, [addPendingAction, removePendingAction, rollbackAction, toast]);

  // Check if ticket has pending actions
  const isTicketPending = useCallback((ticketId: string) => {
    return pendingActions.some(action => action.ticketId === ticketId);
  }, [pendingActions]);

  // Get pending action for ticket
  const getPendingAction = useCallback((ticketId: string) => {
    return pendingActions.find(action => action.ticketId === ticketId);
  }, [pendingActions]);

  return {
    pendingActions,
    optimisticConcludeTicket,
    optimisticStartAttendance,
    isTicketPending,
    getPendingAction,
    rollbackAction
  };
};