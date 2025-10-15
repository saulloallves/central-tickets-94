/**
 * Global SLA Timer Manager
 * Uses a single timer for all SLA calculations to improve performance
 */

type SLAUpdateCallback = (timeRemaining: {
  hours: number;
  minutes: number;
  seconds: number;
  isOverdue: boolean;
  isPaused: boolean;
  totalSeconds: number;
}) => void;

interface SLATicketInput {
  ticketId: string;
  codigoTicket: string;
  dataAbertura: string; // ✅ ADICIONAR para cálculo real
  slaMinutosRestantes: number | null;
  slaMinutosTotais: number | null;
  tempoPausadoTotal?: number; // ✅ ADICIONAR (em minutos)
  status: string;
  slaPausado: boolean;
  slaPausadoMensagem: boolean;
  callback: SLAUpdateCallback;
  onExpired?: (ticketId: string) => void;
}

interface SLATicket extends SLATicketInput {
  localSecondsRemaining: number; // ✅ Contador local em segundos (UI)
  lastSyncedMinutes: number | null; // ✅ Último valor sincronizado do banco
}

class SLATimerManager {
  private tickets: Map<string, SLATicket> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private lastExpiredCheck: Map<string, boolean> = new Map();

  register(ticket: SLATicketInput) {
    const existingTicket = this.tickets.get(ticket.ticketId);
    
    let localSecondsRemaining: number;
    
    // ✅ Calcular tempo REAL baseado em data de abertura
    if (ticket.dataAbertura && ticket.slaMinutosTotais) {
      const abertura = new Date(ticket.dataAbertura).getTime();
      const agora = Date.now();
      const tempoDecorridoMinutos = (agora - abertura) / 60000;
      const tempoPausadoMinutos = ticket.tempoPausadoTotal || 0;
      const tempoRestanteMinutos = ticket.slaMinutosTotais - tempoDecorridoMinutos + tempoPausadoMinutos;
      
      localSecondsRemaining = Math.max(0, Math.floor(tempoRestanteMinutos * 60));
      
      // Se já existe e está próximo (diferença < 5s), preservar para evitar saltos
      if (existingTicket && Math.abs(existingTicket.localSecondsRemaining - localSecondsRemaining) < 5) {
        localSecondsRemaining = existingTicket.localSecondsRemaining;
      } else if (!existingTicket) {
        console.log(`⏱️ Iniciando timer real do ticket ${ticket.codigoTicket}:
          - Aberto há: ${tempoDecorridoMinutos.toFixed(1)} min
          - SLA total: ${ticket.slaMinutosTotais} min
          - Tempo pausado: ${tempoPausadoMinutos} min
          - Restante: ${tempoRestanteMinutos.toFixed(1)} min (${localSecondsRemaining}s)`);
      }
    } else {
      // Fallback: usar valor do banco se não tiver data de abertura
      localSecondsRemaining = (ticket.slaMinutosRestantes || 0) * 60;
    }
    
    const ticketWithLocalTimer: SLATicket = {
      ...ticket,
      localSecondsRemaining,
      lastSyncedMinutes: ticket.slaMinutosRestantes
    };
    
    this.tickets.set(ticket.ticketId, ticketWithLocalTimer);
    
    if (!existingTicket) {
      this.lastExpiredCheck.set(ticket.ticketId, false);
    }
    
    // Start global timer if not running
    if (!this.intervalId) {
      this.startTimer();
    }
    
    // Calculate immediately
    this.updateTicket(ticket.ticketId);
  }

  unregister(ticketId: string) {
    this.tickets.delete(ticketId);
    this.lastExpiredCheck.delete(ticketId);
    
    // Stop timer if no tickets
    if (this.tickets.size === 0 && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private startTimer() {
    this.intervalId = setInterval(() => {
      this.tickets.forEach((ticket, ticketId) => {
        // ✅ Resincronizar se o banco atualizou (via realtime)
        if (ticket.lastSyncedMinutes !== ticket.slaMinutosRestantes) {
          ticket.localSecondsRemaining = (ticket.slaMinutosRestantes || 0) * 60;
          ticket.lastSyncedMinutes = ticket.slaMinutosRestantes;
        }
        
        // ✅ Decrementar contador local se não estiver pausado
        if (!ticket.slaPausado && !ticket.slaPausadoMensagem && ticket.status !== 'concluido') {
          ticket.localSecondsRemaining = Math.max(0, ticket.localSecondsRemaining - 1);
        }
        
        this.updateTicket(ticketId);
      });
    }, 1000);
  }

  private updateTicket(ticketId: string) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return;

    const timeRemaining = this.calculateTimeRemaining(ticket);
    
    // Check if SLA just expired (transition)
    const wasOverdue = this.lastExpiredCheck.get(ticketId) || false;
    if (!wasOverdue && timeRemaining.isOverdue && timeRemaining.totalSeconds === 0) {
      console.log(`🚨 SLA VENCIDO: Ticket ${ticket.codigoTicket} (${ticketId})`);
      if (ticket.onExpired) {
        ticket.onExpired(ticketId);
      }
    }
    
    this.lastExpiredCheck.set(ticketId, timeRemaining.isOverdue);
    ticket.callback(timeRemaining);
  }

  private calculateTimeRemaining(ticket: SLATicket) {
    if (!ticket.slaMinutosRestantes || ticket.status === 'concluido') {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: false, totalSeconds: 0 };
    }

    // ✅ Se pausado, retornar estado pausado (contador congelado)
    if (ticket.slaPausado || ticket.slaPausadoMensagem) {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: true, totalSeconds: 0 };
    }

    // ✅ SLA vencido se contador local chegou a zero
    if (ticket.localSecondsRemaining <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: true, isPaused: false, totalSeconds: 0 };
    }

    // ✅ Usar contador local (em segundos) para exibição em tempo real
    const totalSeconds = ticket.localSecondsRemaining;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { hours, minutes, seconds, isOverdue: false, isPaused: false, totalSeconds };
  }
}

// Singleton instance
export const slaTimerManager = new SLATimerManager();
