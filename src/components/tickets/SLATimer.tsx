import { useState, useEffect } from 'react';

interface SLATimerProps {
  ticketId: string;
  dataLimiteSla: string | null;
  status: string;
  slaPausadoHorario?: boolean;
  onSLAExpired?: (ticketId: string) => void;
}

export const SLATimer = ({ 
  ticketId,
  dataLimiteSla,
  status, 
  slaPausadoHorario = false,
  onSLAExpired 
}: SLATimerProps) => {
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
  }, [ticketId, dataLimiteSla, status, slaPausadoHorario, onSLAExpired]);

  if (!dataLimiteSla || status === 'concluido') {
    return null;
  }

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
      <div className="flex items-center gap-1 text-destructive text-sm font-medium">
        <span className="w-2 h-2 bg-destructive rounded-full animate-pulse"></span>
        <span>{formatReadableTime()}</span>
      </div>
    );
  }

  if (timeRemaining.isPaused) {
    return (
      <div className="flex items-center gap-1 text-amber-600 text-sm font-medium">
        <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
        <span>Pausado - Fora do horário</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-1 text-sm font-medium ${getSLAColor()}`}>
      <span className="w-2 h-2 bg-current rounded-full"></span>
      <span>{formatReadableTime()}</span>
    </div>
  );
};
