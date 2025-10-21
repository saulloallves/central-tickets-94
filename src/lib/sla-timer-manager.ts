/**
 * ============================================================================
 * GLOBAL SLA TIMER MANAGER (FASE 3 - Versão Final)
 * ============================================================================
 * 
 * Sistema centralizado de gerenciamento de timers SLA com sincronização
 * automática com o backend.
 * 
 * ARQUITETURA:
 * - Backend: Calcula SLA usando trigger automático de acúmulo de pausas
 * - Frontend: Exibe e decrementa localmente, ressincroniza a cada 10s
 * 
 * DOCUMENTAÇÃO COMPLETA: Ver src/lib/sla-flags-documentation.ts
 * 
 * ============================================================================
 */

import { isAnyPauseActive } from './sla-flags-documentation';

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
      
      // ✅ Sempre atualizar propriedades do ticket (mas preservar contador)
      existingTicket.slaPausado = ticket.slaPausado;
      existingTicket.slaPausadoMensagem = ticket.slaPausadoMensagem;
      existingTicket.slaPausadoHorario = ticket.slaPausadoHorario;
      existingTicket.status = ticket.status;
      
      // ✅ CRÍTICO: Apenas resincronizar se o valor mudou SIGNIFICATIVAMENTE
      if (ticket.slaMinutosRestantes != null && 
          ticket.slaMinutosRestantes !== existingTicket.lastSyncedMinutes) {
        const bancoSegundos = ticket.slaMinutosRestantes * 60; // ✅ Preservar negativo
        const diferencaSegundos = Math.abs(bancoSegundos - localSecondsRemaining);
        
        // ✅ Só resincronizar se diferença > 60 segundos OU se o valor mudou de sinal
        if (diferencaSegundos > 60 || 
            (bancoSegundos < 0 && localSecondsRemaining >= 0) ||
            (bancoSegundos >= 0 && localSecondsRemaining < 0)) {
          console.log(`🔄 Resincronizando timer ${ticket.codigoTicket}:`, {
            bancoSegundos,
            localSecondsRemaining,
            propMinutos: ticket.slaMinutosRestantes,
            lastSynced: existingTicket.lastSyncedMinutes
          });
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
    // ✅ CRÍTICO: Preservar valores negativos (SLA vencido)
    if (ticket.slaMinutosRestantes != null) {
      localSecondsRemaining = ticket.slaMinutosRestantes * 60; // Pode ser negativo!
      console.log(`⏱️ [INIT] Inicializando ${ticket.codigoTicket}: ${ticket.slaMinutosRestantes}min = ${localSecondsRemaining}s`);
    } else {
      localSecondsRemaining = 0;
      console.log(`⏱️ [INIT] ${ticket.codigoTicket}: slaMinutosRestantes é null, iniciando com 0`);
    }
    
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
        
        if (shouldResync && ticket.slaMinutosRestantes != null) {
          const oldValue = ticket.localSecondsRemaining;
          ticket.localSecondsRemaining = ticket.slaMinutosRestantes * 60;
          ticket.lastSyncedMinutes = ticket.slaMinutosRestantes;
          
          if (Math.abs(oldValue - ticket.localSecondsRemaining) > 5) {
            console.log(`⏱️ [FASE 1] Ressincronizado ${ticket.codigoTicket}: ${Math.floor(oldValue/60)}min → ${ticket.slaMinutosRestantes}min`);
          }
        }
        
        // ✅ FASE 3: Usar função auxiliar para verificar pausas
        const flags = {
          sla_pausado: ticket.slaPausado,
          sla_pausado_mensagem: ticket.slaPausadoMensagem,
          sla_pausado_horario: ticket.slaPausadoHorario
        };
        
        const isPausedNow = isAnyPauseActive(flags);
        
        if (!isPausedNow && ticket.status !== 'concluido' && ticket.localSecondsRemaining > 0) {
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
    if (!wasOverdue && timeRemaining.isOverdue) {
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
    // ✅ Verificar se o ticket foi concluído
    if (ticket.status === 'concluido') {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: false, totalSeconds: 0 };
    }
    
    // ✅ Se localSecondsRemaining não foi inicializado, retornar valores zerados
    if (ticket.localSecondsRemaining === undefined) {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: false, totalSeconds: 0 };
    }

    // ✅ FASE 3: Lógica simplificada usando função auxiliar
    const isSLAOverdue = ticket.localSecondsRemaining <= 0;
    
    console.log(`🐛 [calculateTimeRemaining] ${ticket.codigoTicket}:`, {
      localSecondsRemaining: ticket.localSecondsRemaining,
      isSLAOverdue,
      propMinutosRestantes: ticket.slaMinutosRestantes
    });
    
    if (isSLAOverdue) {
      // ✅ Se localSecondsRemaining for exatamente 0, usar propMinutosRestantes
      const effectiveSeconds = ticket.localSecondsRemaining === 0 && ticket.slaMinutosRestantes != null
        ? ticket.slaMinutosRestantes * 60
        : ticket.localSecondsRemaining;
      
      const absSeconds = Math.abs(effectiveSeconds);
      const hours = Math.floor(absSeconds / 3600);
      const minutes = Math.floor((absSeconds % 3600) / 60);
      const seconds = absSeconds % 60;
      
      console.log(`🐛 [OVERDUE] ${ticket.codigoTicket}: ${hours}h ${minutes}min (${effectiveSeconds}s total)`);
      
      return { 
        hours, 
        minutes, 
        seconds, 
        isOverdue: true, 
        isPaused: false,
        totalSeconds: effectiveSeconds // ✅ Garantir que seja negativo
      };
    }

    // Verificar se está pausado usando função auxiliar
    const flags = {
      sla_pausado: ticket.slaPausado,
      sla_pausado_mensagem: ticket.slaPausadoMensagem,
      sla_pausado_horario: ticket.slaPausadoHorario
    };
    
    const isPausedNow = isAnyPauseActive(flags);
    
    if (isPausedNow) {
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
