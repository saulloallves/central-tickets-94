import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { slaTimerManager } from '@/lib/sla-timer-manager';

interface SLATimerProps {
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

export const SLATimer = ({ 
  ticketId, 
  codigoTicket,
  slaMinutosRestantes,
  slaMinutosTotais,
  status, 
  slaPausado = false,
  slaPausadoMensagem = false,
  slaPausadoHorario = false,
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
      slaMinutosRestantes, // ✅ FASE 1: Backend calcula tudo
      slaMinutosTotais,
      status,
      slaPausado,
      slaPausadoMensagem,
      slaPausadoHorario,
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
      slaTimerManager.unregister(ticketId, setTimeRemaining);
    };
  }, [ticketId, codigoTicket, slaMinutosRestantes, slaMinutosTotais, status, slaPausado, slaPausadoMensagem, slaPausadoHorario, onSLAExpired, toast]);

  if (slaMinutosRestantes == null || status === 'concluido') {
    return null;
  }

  const formatTime = (value: number) => value.toString().padStart(2, '0');

  // Formata o tempo em formato legível (ex: "8h restantes", "30 minutos restantes")
  const formatReadableTime = () => {
    if (slaMinutosRestantes == null) return '';
    
    const minutos = Math.abs(slaMinutosRestantes);
    const horas = Math.floor(minutos / 60);
    const minutosRestantes = minutos % 60;
    
    if (horas > 0) {
      if (minutosRestantes > 0) {
        return `${horas}h ${minutosRestantes}min restantes`;
      }
      return `${horas}h restantes`;
    }
    
    return `${minutos} minutos restantes`;
  };

  // ✅ PRIORIDADE 1: Verificar se SLA venceu ANTES de pausado
  if (timeRemaining.isOverdue) {
    const { hours, minutes } = timeRemaining;
    
    let overdueText = 'Vencido há ';
    if (hours > 0) {
      overdueText += `${hours}h`;
      if (minutes > 0) {
        overdueText += ` ${minutes}min`;
      }
    } else {
      overdueText += `${minutes} minutos`;
    }
    
    return (
      <div className="flex items-center gap-1 text-destructive text-sm font-medium">
        <span className="w-2 h-2 bg-destructive rounded-full animate-pulse"></span>
        <span>{overdueText}</span>
      </div>
    );
  }

  // ✅ PRIORIDADE 2: Se não venceu, verificar se está pausado
  if (timeRemaining.isPaused) {
    let pauseLabel = 'Pausado';
    
    if (slaPausadoHorario) {
      pauseLabel = 'Pausado - Fora do horário';
    } else if (slaPausadoMensagem) {
      pauseLabel = 'Pausado - Aguardando resposta';
    }
    
    return (
      <div className="flex items-center gap-1 text-amber-600 text-sm font-medium">
        <span className="w-2 h-2 bg-amber-600 rounded-full"></span>
        <span>{pauseLabel}</span>
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
    <div className={`flex items-center gap-1 text-sm font-medium ${getSLAColor()}`}>
      <span className="w-2 h-2 bg-current rounded-full"></span>
      <span>{formatReadableTime()}</span>
    </div>
  );
};