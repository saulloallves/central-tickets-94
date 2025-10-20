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
  slaMinutosRestantes: number | null; // ✅ Fonte única de verdade: backend calcula tudo
  slaMinutosTotais: number | null;
  status: string;
  slaPausado: boolean;
  slaPausadoMensagem: boolean;
  slaPausadoHorario?: boolean;
  callback: SLAUpdateCallback;
  onExpired?: (ticketId: string) => void;
}

interface SLATicket extends SLATicketInput {
  localSecondsRemaining: number; // ✅ Contador local em segundos (UI)
  lastSyncedMinutes: number | null; // ✅ Último valor sincronizado do banco
  refCount: number; // ✅ Contador de componentes registrados
  callbacks: Set<SLAUpdateCallback>; // ✅ Múltiplos callbacks (card + modal)
}

class SLATimerManager {
  private tickets: Map<string, SLATicket> = new Map();
  private intervalId: NodeJS.Timeout | null = null;
  private lastExpiredCheck: Map<string, boolean> = new Map();

  register(ticket: SLATicketInput) {
    const existingTicket = this.tickets.get(ticket.ticketId);
    
    let localSecondsRemaining: number;
    
    // ✅ Se o ticket JÁ EXISTE, SEMPRE preservar o contador local (continuar contando)
    if (existingTicket) {
      localSecondsRemaining = existingTicket.localSecondsRemaining;
      
      // ✅ Incrementar contador de referências e adicionar callback
      existingTicket.refCount++;
      existingTicket.callbacks.add(ticket.callback);
      
      console.log(`⏱️ Registrando instância adicional do ticket ${ticket.codigoTicket} (refCount: ${existingTicket.refCount})`);
      
      // Apenas resincronizar com o banco se houver mudança significativa (>1 min)
      if (ticket.slaMinutosRestantes !== existingTicket.lastSyncedMinutes) {
        const bancoSegundos = (ticket.slaMinutosRestantes || 0) * 60;
        const diferencaSegundos = Math.abs(bancoSegundos - localSecondsRemaining);
        
        if (diferencaSegundos > 60) {
          console.log(`⏱️ Resincronizando timer ${ticket.codigoTicket}: banco=${bancoSegundos}s, local=${localSecondsRemaining}s`);
          localSecondsRemaining = bancoSegundos;
          existingTicket.localSecondsRemaining = localSecondsRemaining;
          existingTicket.lastSyncedMinutes = ticket.slaMinutosRestantes;
        }
      }
      
      // Calcular e enviar imediatamente para o novo callback
      this.updateTicket(ticket.ticketId);
      return;
    }
    
    // ✅ FASE 1: Frontend usa APENAS valor calculado pelo backend
    // Backend já usa trigger automático para acumular tempo_pausado_total
    // View tickets_with_realtime_sla retorna sla_minutos_restantes já correto
    localSecondsRemaining = (ticket.slaMinutosRestantes || 0) * 60;
    
    console.log(`⏱️ [FASE 1] Iniciando timer do ticket ${ticket.codigoTicket}:
      - SLA restante (backend): ${ticket.slaMinutosRestantes} min (${localSecondsRemaining}s)
      - Pausado: ${ticket.slaPausado}
      - Pausado mensagem: ${ticket.slaPausadoMensagem}
      - Pausado horário: ${ticket.slaPausadoHorario || false}`);
    
    const ticketWithLocalTimer: SLATicket = {
      ...ticket,
      localSecondsRemaining,
      lastSyncedMinutes: ticket.slaMinutosRestantes,
      refCount: 1, // ✅ Primeira instância
      callbacks: new Set([ticket.callback]) // ✅ Primeiro callback
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

  unregister(ticketId: string, callback: SLAUpdateCallback) {
    const ticket = this.tickets.get(ticketId);
    if (!ticket) return;
    
    // ✅ Remover callback específico
    ticket.callbacks.delete(callback);
    ticket.refCount--;
    
    console.log(`⏱️ Desregistrando instância do ticket ${ticketId} (refCount: ${ticket.refCount})`);
    
    // ✅ Só remover completamente quando não houver mais componentes
    if (ticket.refCount <= 0) {
      console.log(`⏱️ Removendo ticket ${ticketId} completamente (sem mais referências)`);
      this.tickets.delete(ticketId);
      this.lastExpiredCheck.delete(ticketId);
      
      // Stop timer if no tickets
      if (this.tickets.size === 0 && this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
  }

  private startTimer() {
    let tickCounter = 0; // Contador para resincronização periódica
    
    this.intervalId = setInterval(() => {
      tickCounter++;
      
      this.tickets.forEach((ticket, ticketId) => {
        // ✅ FASE 1: Resincronizar com banco a cada 10 segundos (fonte de verdade)
        const shouldResync = tickCounter % 10 === 0 || ticket.lastSyncedMinutes !== ticket.slaMinutosRestantes;
        
        if (shouldResync) {
          const oldValue = ticket.localSecondsRemaining;
          ticket.localSecondsRemaining = (ticket.slaMinutosRestantes || 0) * 60;
          ticket.lastSyncedMinutes = ticket.slaMinutosRestantes;
          
          if (Math.abs(oldValue - ticket.localSecondsRemaining) > 5) {
            console.log(`⏱️ [FASE 1] Ressincronizado ${ticket.codigoTicket}: ${Math.floor(oldValue/60)}min → ${ticket.slaMinutosRestantes}min`);
          }
        }
        
        // ✅ Decrementar APENAS se não estiver pausado (backend já cuida do acúmulo)
        const isAnyPauseActive = ticket.slaPausado || ticket.slaPausadoMensagem || ticket.slaPausadoHorario;
        if (!isAnyPauseActive && ticket.status !== 'concluido' && ticket.localSecondsRemaining > 0) {
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
    
    // ✅ Chamar TODOS os callbacks registrados (card + modal)
    ticket.callbacks.forEach(callback => callback(timeRemaining));
  }

  private calculateTimeRemaining(ticket: SLATicket) {
    if (!ticket.slaMinutosRestantes || ticket.status === 'concluido') {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: false, totalSeconds: 0 };
    }

    // ✅ FASE 1: LÓGICA SIMPLIFICADA
    // Backend já calcula SLA corretamente usando trigger de acúmulo de pausas
    // Frontend apenas exibe o valor do backend e decrementa localmente
    
    const isSLAOverdue = ticket.localSecondsRemaining <= 0;
    
    if (isSLAOverdue) {
      return { 
        hours: 0, 
        minutes: 0, 
        seconds: 0, 
        isOverdue: true, 
        isPaused: false,
        totalSeconds: 0 
      };
    }

    // Verificar se está pausado
    const isAnyPauseActive = ticket.slaPausado || ticket.slaPausadoMensagem || ticket.slaPausadoHorario;
    if (isAnyPauseActive) {
      // Mostrar tempo restante mesmo pausado (mas não decrementa)
      const totalSeconds = ticket.localSecondsRemaining;
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      
      return { hours, minutes, seconds, isOverdue: false, isPaused: true, totalSeconds };
    }

    // SLA ativo (contando normalmente)
    const totalSeconds = ticket.localSecondsRemaining;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { hours, minutes, seconds, isOverdue: false, isPaused: false, totalSeconds };
  }
}

// Singleton instance
export const slaTimerManager = new SLATimerManager();
