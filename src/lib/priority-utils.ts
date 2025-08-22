// Priority utilities for the new priority system

export type TicketPriority = 
  | 'imediato' 
  | 'ate_1_hora' 
  | 'ainda_hoje' 
  | 'posso_esperar' 
  | 'crise'
  // Legacy support
  | 'urgente' 
  | 'alta' 
  | 'hoje_18h' 
  | 'padrao_24h';

export function getPriorityLabel(priority: TicketPriority): string {
  switch (priority) {
    case 'crise': return 'CRISE';
    case 'imediato': return 'Imediato';
    case 'ate_1_hora': return 'Até 1h';
    case 'ainda_hoje': return 'Ainda Hoje';
    case 'posso_esperar': return 'Posso Esperar';
    // Legacy support
    case 'urgente': return 'Urgente';
    case 'alta': return 'Alta';
    case 'hoje_18h': return 'Hoje 18h';
    case 'padrao_24h': return 'Padrão';
    default: return priority;
  }
}

export function getPriorityColor(priority: TicketPriority): string {
  switch (priority) {
    case 'crise': return 'critical';
    case 'imediato': return 'critical';
    case 'ate_1_hora': return 'warning';
    case 'ainda_hoje': return 'outline';
    case 'posso_esperar': return 'outline';
    // Legacy support
    case 'urgente': return 'critical';
    case 'alta': return 'warning';
    case 'hoje_18h': return 'outline';
    case 'padrao_24h': return 'outline';
    default: return 'outline';
  }
}

export function getPriorityBorderColor(priority: TicketPriority): string {
  switch (priority) {
    case 'crise':
    case 'imediato':
    case 'urgente': // Legacy
      return 'border-l-red-500';
    case 'ate_1_hora':
    case 'alta': // Legacy
      return 'border-l-orange-500';
    case 'ainda_hoje':
    case 'hoje_18h': // Legacy
      return 'border-l-amber-500';
    case 'posso_esperar':
    case 'padrao_24h': // Legacy
    default:
      return 'border-l-slate-300';
  }
}

export function getPriorityBackgroundColor(priority: TicketPriority): string {
  switch (priority) {
    case 'crise':
    case 'imediato':
    case 'urgente': // Legacy
      return 'bg-red-50 text-red-700 border border-red-200';
    case 'ate_1_hora':
    case 'alta': // Legacy
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'ainda_hoje':
    case 'hoje_18h': // Legacy
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'posso_esperar':
    case 'padrao_24h': // Legacy
    default:
      return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
}

export function getSLATimeInMinutes(priority: TicketPriority): number {
  switch (priority) {
    case 'crise': return 5;
    case 'imediato': return 15;
    case 'ate_1_hora': return 60;
    case 'ainda_hoje': return 18 * 60; // 18h in minutes
    case 'posso_esperar': return 24 * 60; // 24h in minutes
    // Legacy support
    case 'urgente': return 15; // Updated from 10 to 15
    case 'alta': return 60;
    case 'hoje_18h': return 18 * 60;
    case 'padrao_24h': return 24 * 60;
    default: return 24 * 60;
  }
}

export function isNewPriority(priority: string): boolean {
  return ['imediato', 'ate_1_hora', 'ainda_hoje', 'posso_esperar'].includes(priority);
}

export function mapLegacyToNewPriority(priority: TicketPriority): TicketPriority {
  switch (priority) {
    case 'urgente': return 'imediato';
    case 'alta': return 'ate_1_hora';
    case 'hoje_18h': return 'ainda_hoje';
    case 'padrao_24h': return 'posso_esperar';
    default: return priority;
  }
}