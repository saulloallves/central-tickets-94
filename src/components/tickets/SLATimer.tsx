import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { slaTimerManager } from '@/lib/sla-timer-manager';

interface SLATimerProps {
  ticketId: string;
  codigoTicket: string;
  slaMinutosRestantes: number | null; // ✅ Contador real de minutos
  slaMinutosTotais: number | null;
  status: string;
  slaPausado?: boolean;
  slaPausadoMensagem?: boolean;
  onSLAExpired?: (ticketId: string) => void;
}

export const SLATimer = ({ 
  ticketId, 
  codigoTicket, 
  slaMinutosRestantes, // ✅ Contador real
  slaMinutosTotais,
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
      slaMinutosRestantes, // ✅ Passar contador de minutos
      slaMinutosTotais,
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
  }, [ticketId, codigoTicket, slaMinutosRestantes, slaMinutosTotais, status, slaPausado, slaPausadoMensagem, onSLAExpired, toast]);

  if (!slaMinutosRestantes || status === 'concluido') {
    return null;
  }

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  if (timeRemaining.isPaused) {
    // Detectar múltiplas razões de pausa
    const reasons: string[] = [];
    if (slaPausado) reasons.push('Fora do horário');
    if (slaPausadoMensagem) reasons.push('Aguardando resposta');
    
    const pauseReason = reasons.length > 0 ? reasons.join(' + ') : 'Pausado';
    
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
    if (!slaMinutosTotais) return 'text-muted-foreground';
    
    const percentualRestante = (slaMinutosRestantes || 0) / slaMinutosTotais;
    
    if (percentualRestante > 0.5) return 'text-muted-foreground'; // Mais de 50% - normal
    if (percentualRestante > 0.25) return 'text-yellow-600'; // 25-50% - atenção
    if (percentualRestante > 0.1) return 'text-orange-600'; // 10-25% - alerta
    return 'text-destructive'; // Menos de 10% - crítico
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