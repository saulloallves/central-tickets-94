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

interface SLATicket {
  ticketId: string;
  codigoTicket: string;
  dataLimiteSLA: string | null;
  status: string;
  slaPausado: boolean;
  slaPausadoMensagem: boolean;
  callback: SLAUpdateCallback;
  onExpired?: (ticketId: string) => void;
}

class SLATimerManager {
  private tickets: Map<string, SLATicket> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private lastExpiredCheck: Map<string, boolean> = new Map();

  register(ticket: SLATicket) {
    this.tickets.set(ticket.ticketId, ticket);
    this.lastExpiredCheck.set(ticket.ticketId, false);
    
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
      this.tickets.forEach((_, ticketId) => {
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
    if (!ticket.dataLimiteSLA || ticket.status === 'concluido') {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: false, totalSeconds: 0 };
    }

    // SLA pausado se QUALQUER uma das condições for verdadeira
    if (ticket.slaPausado || ticket.slaPausadoMensagem) {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: true, totalSeconds: 0 };
    }

    const now = new Date();
    const slaDate = new Date(ticket.dataLimiteSLA);
    const diffMs = slaDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: true, isPaused: false, totalSeconds: 0 };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { hours, minutes, seconds, isOverdue: false, isPaused: false, totalSeconds };
  }
}

// Singleton instance
export const slaTimerManager = new SLATimerManager();
