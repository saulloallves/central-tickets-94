/**
 * ============================================================================
 * DOCUMENTAÇÃO COMPLETA: Sistema de Flags de Pausa de SLA
 * ============================================================================
 * 
 * Este arquivo documenta TODAS as flags que controlam o pausamento do SLA.
 * 
 * REGRA FUNDAMENTAL:
 * Se QUALQUER uma das flags abaixo for `true`, o SLA NÃO decrementa.
 * O tempo pausado é ACUMULADO automaticamente pelo trigger do banco de dados.
 * 
 * ============================================================================
 */

export interface SLAPauseFlags {
  /**
   * ⏸️ SLA_PAUSADO (Pausa Manual - DEPRECATED)
   * 
   * ATENÇÃO: Esta flag foi removida do sistema.
   * Mantida apenas para compatibilidade com código legado.
   * 
   * Não é mais usada para pausar SLA.
   */
  sla_pausado: boolean;

  /**
   * 🕐 SLA_PAUSADO_HORARIO (Pausa por Horário Comercial)
   * 
   * Quando ativa: Estamos fora do horário comercial (ex: noite, fim de semana)
   * Motivo: SLA só conta durante horário de expediente
   * 
   * Como pausar: Edge function `pause-sla-processor` executa via cron
   * Como despausar: Edge function `pause-sla-processor` executa via cron
   * 
   * Impacto: SLA não decrementa fora do horário comercial
   * 
   * Horário padrão: 08:30 - 18:00 (dias úteis)
   */
  sla_pausado_horario?: boolean;
}

/**
 * ============================================================================
 * COMO O SISTEMA DE PAUSA FUNCIONA (FASE 1)
 * ============================================================================
 * 
 * 1. TRIGGER AUTOMÁTICO (Backend)
 *    - Quando QUALQUER flag muda de false → true: salva timestamp em `ultima_pausa_timestamp`
 *    - Quando TODAS flags mudam de true → false: calcula diferença e acumula em `tempo_pausado_total`
 * 
 * 2. CÁLCULO DE SLA (Backend - função calcular_sla_tempo_real)
 *    - SLA restante = SLA total - tempo decorrido + tempo pausado acumulado
 *    - Fórmula: sla_restante = sla_minutos_totais - tempo_decorrido_minutos + tempo_pausado_minutos
 * 
 * 3. FRONTEND (Timer Manager)
 *    - Busca `sla_minutos_restantes` já calculado pelo backend
 *    - Decrementa localmente a cada 1s SE nenhuma pausa estiver ativa
 *    - Resincroniza com backend a cada 10s
 * 
 * ============================================================================
 * EXEMPLOS DE USO
 * ============================================================================
 * 
 * EXEMPLO 1: Ticket com 400 minutos de SLA
 * - Abertura: 10:00
 * - Cliente responde: 10:30 (30 min decorridos) → sla_pausado_mensagem = true
 * - Atendente responde: 11:00 (30 min pausados) → sla_pausado_mensagem = false
 * - Agora: 12:00 (mais 60 min decorridos)
 * 
 * Cálculo:
 * - Tempo decorrido total: 120 min (10:00 → 12:00)
 * - Tempo pausado: 30 min (10:30 → 11:00)
 * - SLA restante: 400 - 120 + 30 = 310 minutos ✅
 * 
 * EXEMPLO 2: Múltiplas pausas
 * - SLA total: 400 min
 * - Pausa 1: 20 min (mensagem)
 * - Pausa 2: 15 min (manual)
 * - Pausa 3: 480 min (horário comercial - noite toda)
 * - Tempo decorrido: 600 min
 * 
 * Cálculo:
 * - Tempo pausado total: 20 + 15 + 480 = 515 min
 * - SLA restante: 400 - 600 + 515 = 315 minutos ✅
 * 
 * ============================================================================
 */

/**
 * Verifica se QUALQUER flag de pausa está ativa
 */
export const isAnyPauseActive = (flags: SLAPauseFlags): boolean => {
  return flags.sla_pausado_horario || false;
};

/**
 * Retorna a razão da pausa (para exibir ao usuário)
 */
export const getPauseReason = (flags: SLAPauseFlags): string | null => {
  if (flags.sla_pausado_horario) {
    return 'Fora do horário comercial';
  }
  return null;
};

/**
 * Retorna ícone apropriado para o tipo de pausa
 */
export const getPauseIcon = (flags: SLAPauseFlags): string => {
  if (flags.sla_pausado_horario) return '🕐';
  return '▶️'; // Ativo
};

/**
 * ============================================================================
 * TROUBLESHOOTING
 * ============================================================================
 * 
 * ❌ PROBLEMA: Timer não pausa quando flag é ativada
 * ✅ SOLUÇÃO: Verificar se realtime está funcionando (logs no console)
 * 
 * ❌ PROBLEMA: Tempo pausado não acumula
 * ✅ SOLUÇÃO: Verificar se trigger `acumular_tempo_pausado` está ativo no banco
 * 
 * ❌ PROBLEMA: SLA vence mesmo pausado
 * ✅ SOLUÇÃO: Backend calcula SLA antes de frontend. Verificar view `tickets_with_realtime_sla`
 * 
 * ❌ PROBLEMA: Timer fica dessinchronizado
 * ✅ SOLUÇÃO: Frontend ressincroniza a cada 10s. Aguardar ou forçar refetch
 * 
 * ============================================================================
 */
