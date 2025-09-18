import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

interface SLATimerProps {
  ticketId: string;
  codigoTicket: string;
  dataLimiteSLA: string | null;
  status: string;
  onSLAExpired?: (ticketId: string) => void;
}

export const SLATimer = ({ 
  ticketId, 
  codigoTicket, 
  dataLimiteSLA, 
  status, 
  onSLAExpired 
}: SLATimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isOverdue: boolean;
    totalSeconds: number;
  }>({ hours: 0, minutes: 0, seconds: 0, isOverdue: false, totalSeconds: 0 });
  
  const { toast } = useToast();

  const calculateTimeRemaining = () => {
    if (!dataLimiteSLA || status === 'concluido') {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: false, totalSeconds: 0 };
    }

    const now = new Date();
    const slaDate = new Date(dataLimiteSLA);
    const diffMs = slaDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return { hours: 0, minutes: 0, seconds: 0, isOverdue: true, totalSeconds: 0 };
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return { hours, minutes, seconds, isOverdue: false, totalSeconds };
  };

  useEffect(() => {
    const updateTimer = () => {
      const newTime = calculateTimeRemaining();
      const wasOverdue = timeRemaining.isOverdue;
      
      setTimeRemaining(newTime);

      // Se o SLA acabou de vencer (transição de tempo restante para vencido)
      if (!wasOverdue && newTime.isOverdue && newTime.totalSeconds === 0) {
        console.log(`🚨 SLA VENCIDO: Ticket ${codigoTicket} (${ticketId})`);
        
        // Dispara notificação visual
        toast({
          title: '🚨 SLA Vencido!',
          description: `Ticket ${codigoTicket} teve o SLA vencido e será escalado automaticamente`,
          variant: 'destructive',
        });

        // Chama callback se fornecido
        if (onSLAExpired) {
          onSLAExpired(ticketId);
        }
      }
    };

    // Atualiza imediatamente
    updateTimer();

    // Atualiza a cada segundo
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [ticketId, dataLimiteSLA, status, codigoTicket, timeRemaining.isOverdue, onSLAExpired, toast]);

  if (!dataLimiteSLA || status === 'concluido') {
    return null;
  }

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  if (timeRemaining.isOverdue) {
    return (
      <div className="flex items-center gap-1 text-destructive text-sm font-medium">
        <span className="w-2 h-2 bg-destructive rounded-full animate-pulse"></span>
        <span>SLA Vencido</span>
      </div>
    );
  }

  // Calcula a porcentagem do SLA consumido para determinar a cor
  const getSLAColor = () => {
    const totalTime = timeRemaining.totalSeconds;
    if (totalTime > 3600) return 'text-muted-foreground'; // Mais de 1 hora - normal
    if (totalTime > 1800) return 'text-yellow-600'; // 30-60 min - atenção
    if (totalTime > 600) return 'text-orange-600'; // 10-30 min - alerta
    return 'text-destructive'; // Menos de 10 min - crítico
  };

  return (
    <div className={`flex items-center gap-1 text-sm font-mono ${getSLAColor()}`}>
      <span className="w-2 h-2 bg-current rounded-full"></span>
      <span>
        {timeRemaining.hours > 0 && `${formatTime(timeRemaining.hours)}:`}
        {formatTime(timeRemaining.minutes)}:{formatTime(timeRemaining.seconds)}
      </span>
    </div>
  );
};