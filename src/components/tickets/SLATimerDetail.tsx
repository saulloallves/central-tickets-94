import { useState, useEffect } from 'react';

interface SLATimerDetailProps {
  ticketId: string;
  dataLimiteSla: string | null;
  status: string;
  slaPausadoHorario?: boolean;
  onSLAExpired?: (ticketId: string) => void;
  slaMinutosTotais?: number;
  dataAbertura?: string;
  slaMinutosRestantes?: number; // Valor pré-calculado do banco
}

export const SLATimerDetail = ({ 
  ticketId,
  dataLimiteSla,
  status, 
  slaPausadoHorario = false,
  onSLAExpired,
  slaMinutosTotais,
  dataAbertura,
  slaMinutosRestantes
}: SLATimerDetailProps) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isOverdue: boolean;
    isPaused: boolean;
  }>({ hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: false });

  useEffect(() => {
    if (!dataLimiteSla || status === 'concluido') {
      return;
    }

    const calculateTime = () => {
      if (slaPausadoHorario) {
        setTimeRemaining({
          hours: 0,
          minutes: 0,
          seconds: 0,
          isOverdue: false,
          isPaused: true
        });
        return;
      }

      // ✅ PRIORIZAR: sla_minutos_restantes do banco (considera horário comercial + pausas)
      if (slaMinutosRestantes !== undefined && slaMinutosRestantes !== null) {
        if (slaMinutosRestantes <= 0) {
          // SLA vencido
          const minutosVencidos = Math.abs(slaMinutosRestantes);
          setTimeRemaining({
            hours: Math.floor(minutosVencidos / 60),
            minutes: minutosVencidos % 60,
            seconds: 0,
            isOverdue: true,
            isPaused: false
          });
          
          if (onSLAExpired) {
            onSLAExpired(ticketId);
          }
        } else {
          // SLA ativo
          setTimeRemaining({
            hours: Math.floor(slaMinutosRestantes / 60),
            minutes: slaMinutosRestantes % 60,
            seconds: 0,
            isOverdue: false,
            isPaused: false
          });
        }
        return;
      }

      // ⚠️ FALLBACK: cálculo baseado em data_limite_sla (NÃO considera horário comercial)
      const now = new Date();
      const deadline = new Date(dataLimiteSla);
      const diffMs = deadline.getTime() - now.getTime();

      if (diffMs < 0) {
        const overdueMins = Math.floor(Math.abs(diffMs) / 60000);
        const newState = {
          hours: Math.floor(overdueMins / 60),
          minutes: overdueMins % 60,
          seconds: 0,
          isOverdue: true,
          isPaused: false
        };
        setTimeRemaining(newState);
        if (onSLAExpired) onSLAExpired(ticketId);
        return;
      }

      const totalSeconds = Math.floor(diffMs / 1000);
      setTimeRemaining({
        hours: Math.floor(totalSeconds / 3600),
        minutes: Math.floor((totalSeconds % 3600) / 60),
        seconds: totalSeconds % 60,
        isOverdue: false,
        isPaused: false
      });
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);

    return () => clearInterval(interval);
  }, [ticketId, dataLimiteSla, status, slaPausadoHorario, onSLAExpired, slaMinutosTotais, dataAbertura, slaMinutosRestantes]);

  if (!dataLimiteSla || status === 'concluido') {
    return null;
  }

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  const formatReadableTime = () => {
    const { hours, minutes, isOverdue, isPaused } = timeRemaining;
    
    if (isPaused) {
      return 'Pausado (fora do expediente)';
    }
    
    if (isOverdue) {
      if (hours > 0) {
        return `Vencido há ${hours}h ${minutes}min`;
      }
      return `Vencido há ${minutes}min`;
    }
    
    if (hours > 0) {
      return `${hours}h ${minutes}min restantes`;
    }
    return `${minutes}min restantes`;
  };

  const getSLAColor = () => {
    if (timeRemaining.isPaused) return 'text-muted-foreground';
    if (timeRemaining.isOverdue) return 'text-destructive';
    
    const totalMinutes = timeRemaining.hours * 60 + timeRemaining.minutes;
    
    if (totalMinutes < 15) return 'text-destructive';
    if (totalMinutes < 30) return 'text-yellow-600';
    return 'text-muted-foreground';
  };

  if (timeRemaining.isOverdue) {
    return (
      <div className="text-destructive text-sm font-medium">
        {formatReadableTime()}
      </div>
    );
  }

  if (timeRemaining.isPaused) {
    return (
      <div className="text-amber-600 text-sm font-medium">
        Pausado (fora do horário)
      </div>
    );
  }

  return (
    <div className={`text-sm font-medium ${getSLAColor()}`}>
      {formatReadableTime()}
    </div>
  );
};
