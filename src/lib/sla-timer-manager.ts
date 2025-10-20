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
  slaSegundosRestantes?: number | null; // ✅ NOVO - Precisão em segundos do banco
  slaMinutosTotais: number | null;
  tempoPausadoTotal?: number; // ✅ ADICIONAR (em minutos)
  status: string;
  slaPausado: boolean;
  slaPausadoMensagem: boolean;
  slaPausadoHorario?: boolean; // ✅ NOVO - Pausado por horário comercial
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
    
    // ✅ Se o ticket JÁ EXISTE, PRESERVAR contador local (NUNCA resetar!)
    if (existingTicket) {
      // ✅ PRESERVAR o contador local que está rodando
      localSecondsRemaining = existingTicket.localSecondsRemaining;
      
      // ✅ Atualizar APENAS metadados (pausas, status) SEM tocar no contador
      existingTicket.slaMinutosTotais = ticket.slaMinutosTotais;
      existingTicket.tempoPausadoTotal = ticket.tempoPausadoTotal;
      existingTicket.slaPausado = ticket.slaPausado;
      existingTicket.slaPausadoMensagem = ticket.slaPausadoMensagem;
      existingTicket.slaPausadoHorario = ticket.slaPausadoHorario;
      existingTicket.status = ticket.status;
      
      // ⚠️ Só resincronizar se diferença > 2 segundos (evitar resets desnecessários)
      const bancoSegundos = ticket.slaSegundosRestantes ?? (ticket.slaMinutosRestantes || 0) * 60;
      const diferencaSegundos = Math.abs(bancoSegundos - existingTicket.localSecondsRemaining);
      
      if (diferencaSegundos > 2) {
        console.log(`🔄 Resincronizando timer ${ticket.codigoTicket}: banco=${bancoSegundos}s, local=${existingTicket.localSecondsRemaining}s`);
        existingTicket.localSecondsRemaining = bancoSegundos;
        existingTicket.lastSyncedMinutes = ticket.slaMinutosRestantes;
      }
      
      // ✅ Incrementar contador de referências e adicionar callback
      existingTicket.refCount++;
      existingTicket.callbacks.add(ticket.callback);
      
      console.log(`⏱️ Registrando instância adicional do ticket ${ticket.codigoTicket} (refCount: ${existingTicket.refCount}) - Local: ${existingTicket.localSecondsRemaining}s`);
      
      // Calcular e enviar imediatamente para o novo callback
      this.updateTicket(ticket.ticketId);
      return;
    }
    
    // ✅ Novo ticket: usar precisão de segundos do banco (se disponível)
    localSecondsRemaining = ticket.slaSegundosRestantes ?? (ticket.slaMinutosRestantes || 0) * 60;
    
    console.log(`⏱️ Iniciando timer do ticket ${ticket.codigoTicket}:
      - SLA restante do banco: ${localSecondsRemaining}s (${Math.floor(localSecondsRemaining / 60)}min)
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
    this.intervalId = setInterval(() => {
      this.tickets.forEach((ticket, ticketId) => {
        // ✅ NÃO resincronizar automaticamente - preservar contador local
        // A resincronização só acontece no register() se diferença > 2s
        
        // ✅ Decrementar contador local se não estiver pausado
        if (!ticket.slaPausado && !ticket.slaPausadoMensagem && !ticket.slaPausadoHorario && ticket.status !== 'concluido') {
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

    // ✅ PRIORIDADE 1: Verificar se SLA está VENCIDO (fonte de verdade: banco)
    // Se sla_minutos_restantes <= 0 OU localSecondsRemaining <= 0 → VENCIDO
    const isSLAOverdue = ticket.slaMinutosRestantes <= 0 || ticket.localSecondsRemaining <= 0;
    
    if (isSLAOverdue) {
      // ✅ SLA VENCIDO - Mostrar como vencido INDEPENDENTEMENTE de estar pausado
      return { 
        hours: 0, 
        minutes: 0, 
        seconds: 0, 
        isOverdue: true, 
        isPaused: false,  // ❌ NÃO mostrar como pausado se venceu
        totalSeconds: 0 
      };
    }

    // ✅ PRIORIDADE 2: Se NÃO venceu, verificar se está pausado
    if (ticket.slaPausado || ticket.slaPausadoMensagem || ticket.slaPausadoHorario) {
      return { 
        hours: 0, 
        minutes: 0, 
        seconds: 0, 
        isOverdue: false, 
        isPaused: true, 
        totalSeconds: 0 
      };
    }

    // ✅ PRIORIDADE 3: SLA ativo (contando normalmente)
    const totalSeconds = ticket.localSecondsRemaining;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { hours, minutes, seconds, isOverdue: false, isPaused: false, totalSeconds };
  }
}

// Singleton instance
export const slaTimerManager = new SLATimerManager();
