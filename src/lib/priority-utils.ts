// Priority utilities for the new priority system

export type TicketPriority = 
  | 'baixo' 
  | 'medio' 
  | 'alto' 
  | 'imediato' 
  | 'crise';

export function getPriorityLabel(priority: TicketPriority): string {
  switch (priority) {
    case 'crise': return 'CRISE';
    case 'imediato': return 'Imediato';
    case 'alto': return 'Alto';
    case 'medio': return 'Médio';
    case 'baixo': return 'Baixo';
    default: return priority;
  }
}

export function getPriorityColor(priority: TicketPriority): string {
  switch (priority) {
    case 'crise': return 'critical';
    case 'imediato': return 'critical';
    case 'alto': return 'warning';
    case 'medio': return 'outline';
    case 'baixo': return 'outline';
    default: return 'outline';
  }
}

export function getPriorityBorderColor(priority: TicketPriority): string {
  switch (priority) {
    case 'crise':
    case 'imediato':
      return 'border-l-red-500';
    case 'alto':
      return 'border-l-orange-500';
    case 'medio':
      return 'border-l-amber-500';
    case 'baixo':
    default:
      return 'border-l-slate-300';
  }
}

export function getPriorityBackgroundColor(priority: TicketPriority): string {
  switch (priority) {
    case 'crise':
    case 'imediato':
      return 'bg-red-50 text-red-700 border border-red-200';
    case 'alto':
      return 'bg-orange-50 text-orange-700 border border-orange-200';
    case 'medio':
      return 'bg-amber-50 text-amber-700 border border-amber-200';
    case 'baixo':
    default:
      return 'bg-slate-50 text-slate-700 border border-slate-200';
  }
}

export function getSLATimeInMinutes(priority: TicketPriority): number {
  switch (priority) {
    case 'crise': return 5;
    case 'imediato': return 15;
    case 'alto': return 60;
    case 'medio': return 10 * 60; // 10h in minutes
    case 'baixo': return 24 * 60; // 24h in minutes
    default: return 24 * 60;
  }
}

export function isNewPriority(priority: string): boolean {
  return ['baixo', 'medio', 'alto', 'imediato'].includes(priority);
}