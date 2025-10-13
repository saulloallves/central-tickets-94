import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { slaTimerManager } from '@/lib/sla-timer-manager';

interface SLATimerProps {
  ticketId: string;
  codigoTicket: string;
  dataLimiteSLA: string | null;
  tempoPausadoTotal?: string; // ✅ NOVO: Tempo pausado acumulado
  status: string;
  slaPausado?: boolean;
  slaPausadoMensagem?: boolean;
  onSLAExpired?: (ticketId: string) => void;
}

export const SLATimer = ({ 
  ticketId, 
  codigoTicket, 
  dataLimiteSLA, 
  tempoPausadoTotal, // ✅ NOVO
  status, 
  slaPausado = false,
  slaPausadoMensagem = false,
  onSLAExpired 
}: SLATimerProps) => {
  const [timeRemaining, setTimeRemaining] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    isOverdue: boolean;
    isPaused: boolean;
    totalSeconds: number;
  }>({ hours: 0, minutes: 0, seconds: 0, isOverdue: false, isPaused: false, totalSeconds: 0 });
  
  const { toast } = useToast();

  // Use global SLA timer manager for better performance
  useEffect(() => {
    slaTimerManager.register({
      ticketId,
      codigoTicket,
      dataLimiteSLA,
      tempoPausadoTotal, // ✅ NOVO: Passar tempo pausado para o manager
      status,
      slaPausado,
      slaPausadoMensagem,
      callback: setTimeRemaining,
      onExpired: (id) => {
        toast({
          title: '🚨 SLA Vencido!',
          description: `Ticket ${codigoTicket} teve o SLA vencido e será escalado automaticamente`,
          variant: 'destructive',
        });
        
        if (onSLAExpired) {
          onSLAExpired(id);
        }
      }
    });

    return () => {
      slaTimerManager.unregister(ticketId);
    };
  }, [ticketId, codigoTicket, dataLimiteSLA, tempoPausadoTotal, status, slaPausado, slaPausadoMensagem, onSLAExpired, toast]);

  if (!dataLimiteSLA || status === 'concluido') {
    return null;
  }

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  if (timeRemaining.isPaused) {
    const pauseReason = slaPausado ? 'Fora do horário' : 'Aguardando resposta';
    
    return (
      <div className="flex items-center gap-1 text-amber-600 text-sm font-medium">
        <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
        <span>SLA Pausado ({pauseReason})</span>
      </div>
    );
  }

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