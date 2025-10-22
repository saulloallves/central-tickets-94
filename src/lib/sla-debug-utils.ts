import { getSLATimeInMinutes } from './priority-utils';
import type { TicketPriority } from './priority-utils';

/**
 * Retorna o SLA esperado em minutos baseado na prioridade
 */
export function getExpectedSLAMinutes(priority: string): number {
  return getSLATimeInMinutes(priority as TicketPriority);
}

/**
 * Calcula a discrepância entre o SLA esperado e o configurado
 */
export function calculateSLADiscrepancy(priority: string, configuredMinutes: number): {
  difference: number;
  hasDiscrepancy: boolean;
  isLower: boolean;
} {
  const expected = getExpectedSLAMinutes(priority);
  const difference = configuredMinutes - expected;
  
  return {
    difference,
    hasDiscrepancy: difference !== 0,
    isLower: difference < 0
  };
}

/**
 * Calcula o tempo decorrido entre duas datas
 */
export function calculateElapsedTime(start: string, end: string): {
  totalMinutes: number;
  days: number;
  hours: number;
  minutes: number;
  formatted: string;
} {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diffMs = endDate.getTime() - startDate.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 || parts.length === 0) parts.push(`${minutes}min`);
  
  return {
    totalMinutes,
    days,
    hours,
    minutes,
    formatted: parts.join(' ')
  };
}

/**
 * Formata minutos em formato legível
 */
export function formatMinutes(minutes: number): string {
  if (minutes === 0) return '0 min';
  
  const days = Math.floor(minutes / (60 * 24));
  const hours = Math.floor((minutes % (60 * 24)) / 60);
  const mins = minutes % 60;
  
  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}min`);
  
  return `${minutes} min (${parts.join(' ')})`;
}

/**
 * Detecta problemas no SLA do ticket
 */
export function detectSLAIssues(ticket: {
  prioridade: string;
  sla_minutos_totais?: number;
  sla_minutos_restantes?: number;
  sla_vencido?: boolean;
}): {
  hasIssue: boolean;
  issues: string[];
  severity: 'none' | 'warning' | 'error';
} {
  const issues: string[] = [];
  
  // Verifica se o SLA configurado difere do esperado
  if (ticket.sla_minutos_totais) {
    const discrepancy = calculateSLADiscrepancy(ticket.prioridade, ticket.sla_minutos_totais);
    if (discrepancy.hasDiscrepancy) {
      const diff = Math.abs(discrepancy.difference);
      issues.push(
        `SLA configurado ${discrepancy.isLower ? 'menor' : 'maior'} que o esperado (${diff} min de diferença)`
      );
    }
  }
  
  // Verifica se o SLA está vencido
  if (ticket.sla_vencido) {
    issues.push('SLA vencido');
  }
  
  // Verifica se está próximo do vencimento (< 30% restante)
  if (ticket.sla_minutos_totais && ticket.sla_minutos_restantes !== undefined) {
    const percentRemaining = (ticket.sla_minutos_restantes / ticket.sla_minutos_totais) * 100;
    if (percentRemaining < 30 && percentRemaining > 0) {
      issues.push(`Apenas ${Math.round(percentRemaining)}% do SLA restante`);
    }
  }
  
  const hasIssue = issues.length > 0;
  const severity = ticket.sla_vencido ? 'error' : hasIssue ? 'warning' : 'none';
  
  return { hasIssue, issues, severity };
}

/**
 * Calcula o tempo decorrido em horário comercial
 */
export function calculateElapsedBusinessMinutes(
  slaTotal: number,
  slaRestante: number,
  tempoPausado: number
): number {
  return slaTotal - slaRestante - tempoPausado;
}

/**
 * Explica como os minutos restantes foram calculados
 */
export function explainRemainingTime(
  slaTotal: number,
  slaRestante: number,
  tempoPausado: number,
  isPausado: boolean
): {
  tempoDecorrido: number;
  tempoAtivo: number;
  calculo: string;
  observacao?: string;
} {
  const tempoDecorrido = calculateElapsedBusinessMinutes(slaTotal, slaRestante, tempoPausado);
  const tempoAtivo = tempoDecorrido;
  
  let calculo = '';
  if (tempoPausado > 0) {
    calculo = `De ${formatMinutes(slaTotal)} de SLA total, já passaram ${formatMinutes(tempoDecorrido)} em horário comercial. Porém, ${formatMinutes(tempoPausado)} foram pausados (fora do expediente), restando ${formatMinutes(Math.max(0, slaRestante))}.`;
  } else {
    calculo = `De ${formatMinutes(slaTotal)} de SLA total, já passaram ${formatMinutes(tempoDecorrido)} em horário comercial, restando ${formatMinutes(Math.max(0, slaRestante))}.`;
  }
  
  let observacao: string | undefined;
  if (isPausado) {
    observacao = 'O SLA está pausado agora (fora do expediente), então os minutos restantes não estão diminuindo no momento.';
  }
  
  return {
    tempoDecorrido,
    tempoAtivo,
    calculo,
    observacao
  };
}

/**
 * Explica por que o SLA em tempo corrido pode ser diferente do SLA em minutos
 */
export function explainBusinessHoursSLA(
  dataAbertura: string,
  dataLimiteSLA: string,
  minutosExpediente: number
): {
  tempoCorreidoTotal: string;
  tempoExpediente: string;
  explicacao: string;
} {
  const elapsed = calculateElapsedTime(dataAbertura, dataLimiteSLA);
  const expediente = formatMinutes(minutosExpediente);
  
  const horasForaExpediente = elapsed.totalMinutes - minutosExpediente;
  
  const explicacao = horasForaExpediente > 0
    ? `De ${new Date(dataAbertura).toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })} até ${new Date(dataLimiteSLA).toLocaleString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })} são ${elapsed.formatted} corridos. Porém, apenas ${expediente} são contados, pois o SLA só avança em horário comercial (8:30-17:30, Seg-Sáb). Foram ignorados ${formatMinutes(horasForaExpediente)} fora do expediente.`
    : `O tempo corrido coincide com o tempo de expediente.`;
  
  return {
    tempoCorreidoTotal: elapsed.formatted,
    tempoExpediente: expediente,
    explicacao
  };
}
