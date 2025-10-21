import { useState, useEffect } from 'react';
import { slaTimerManager } from '@/lib/sla-timer-manager';

interface SLATimerDetailProps {
  ticketId: string;
  codigoTicket: string;
  slaMinutosRestantes: number | null;
  slaMinutosTotais: number | null;
  status: string;
  slaPausado?: boolean;
  slaPausadoMensagem?: boolean;
  slaPausadoHorario?: boolean;
  onSLAExpired?: (ticketId: string) => void;
}

export const SLATimerDetail = ({ 
  ticketId, 
  codigoTicket,
  slaMinutosRestantes,
  slaMinutosTotais,
  status, 
  slaPausado = false,
  slaPausadoMensagem = false,
  slaPausadoHorario = false,
  onSLAExpired 
}: SLATimerDetailProps) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isOverdue: boolean;
    isPaused: boolean;
    totalSeconds: number;
  }>({ hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: false, totalSeconds: 0 });

  useEffect(() => {
    slaTimerManager.register({
      ticketId,
      codigoTicket,
      slaMinutosRestantes, // ✅ FASE 1: Backend calcula tudo
      slaMinutosTotais,
      status,
      slaPausado,
      slaPausadoMensagem,
      slaPausadoHorario,
      callback: setTimeRemaining,
      onExpired: onSLAExpired
    });

    return () => {
      slaTimerManager.unregister(ticketId, setTimeRemaining);
    };
  }, [ticketId, codigoTicket, slaMinutosRestantes, slaMinutosTotais, status, slaPausado, slaPausadoMensagem, slaPausadoHorario, onSLAExpired]);

  if (slaMinutosRestantes == null || status === 'concluido') {
    return null;
  }

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  const formatReadableTime = () => {
    // ✅ Usa o valor calculado pelo timer manager
    const totalMinutos = Math.floor(Math.abs(timeRemaining.totalSeconds) / 60);
    const horas = Math.floor(totalMinutos / 60);
    const minutosRestantes = totalMinutos % 60;
    
    if (horas > 0) {
      if (minutosRestantes > 0) {
        return `${horas}h ${minutosRestantes}min restantes`;
      }
      return `${horas}h restantes`;
    }
    
    return `${totalMinutos} minutos restantes`;
  };

  // ✅ PRIORIDADE 1: Verificar se SLA venceu ANTES de pausado
  if (timeRemaining.isOverdue) {
    // ✅ Se totalSeconds é 0, não temos dados suficientes para calcular
    if (timeRemaining.totalSeconds === 0) {
      return (
        <div className="text-destructive text-sm font-medium">
          Vencido
        </div>
      );
    }
    
    // ✅ Calcular a partir de totalSeconds (que é negativo)
    const totalMinutos = Math.floor(Math.abs(timeRemaining.totalSeconds) / 60);
    const horas = Math.floor(totalMinutos / 60);
    const minutos = totalMinutos % 60;
    
    let overdueText = 'Vencido há ';
    if (horas > 0) {
      overdueText += `${horas}h`;
      if (minutos > 0) {
        overdueText += ` ${minutos}min`;
      }
    } else {
      overdueText += `${totalMinutos} minutos`;
    }
    
    return (
      <div className="text-destructive text-sm font-medium">
        {overdueText}
      </div>
    );
  }

  // ✅ PRIORIDADE 2: Se não venceu, verificar se está pausado
  if (timeRemaining.isPaused) {
    const readableTime = formatReadableTime();
    
    let pauseReason = '';
    
    if (slaPausadoHorario) {
      pauseReason = 'Fora do horário';
    } else if (slaPausadoMensagem) {
      pauseReason = 'Aguardando resposta';
    } else {
      pauseReason = 'Pausado';
    }
    
    return (
      <div className="text-amber-600 text-sm font-medium">
        {readableTime} (Pausado - {pauseReason})
      </div>
    );
  }

  const getSLAColor = () => {
    if (!slaMinutosTotais) return 'text-muted-foreground';
    
    const percentualRestante = (slaMinutosRestantes || 0) / slaMinutosTotais;
    
    if (percentualRestante > 0.5) return 'text-muted-foreground';
    if (percentualRestante > 0.25) return 'text-yellow-600';
    if (percentualRestante > 0.1) return 'text-orange-600';
    return 'text-destructive';
  };

  return (
    <div className={`text-sm font-medium ${getSLAColor()}`}>
      {formatReadableTime()}
    </div>
  );
};
