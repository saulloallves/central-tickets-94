import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { slaTimerManager } from '@/lib/sla-timer-manager';

interface SLATimerDetailProps {
  ticketId: string;
  codigoTicket: string;
  dataAbertura: string; // ✅ Data de abertura para cálculo real
  slaMinutosRestantes: number | null;
  slaSegundosRestantes?: number | null; // ✅ NOVO - Precisão em segundos do banco
  slaMinutosTotais: number | null;
  tempoPausadoTotal?: number; // ✅ Tempo pausado em minutos
  status: string;
  slaPausado?: boolean;
  slaPausadoMensagem?: boolean;
  slaPausadoHorario?: boolean; // ✅ NOVO - Pausado por horário comercial
  onSLAExpired?: (ticketId: string) => void;
}

export const SLATimerDetail = ({ 
  ticketId, 
  codigoTicket,
  dataAbertura, // ✅ Receber data de abertura
  slaMinutosRestantes,
  slaSegundosRestantes, // ✅ NOVO - Precisão em segundos
  slaMinutosTotais,
  tempoPausadoTotal = 0, // ✅ Receber tempo pausado
  status, 
  slaPausado = false,
  slaPausadoMensagem = false,
  slaPausadoHorario = false, // ✅ NOVO
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
  
  const { toast } = useToast();

  useEffect(() => {
    slaTimerManager.register({
      ticketId,
      codigoTicket,
      dataAbertura, // ✅ Passar data de abertura
      slaMinutosRestantes,
      slaSegundosRestantes, // ✅ NOVO - Passar segundos para precisão
      slaMinutosTotais,
      tempoPausadoTotal, // ✅ Passar tempo pausado
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
  }, [ticketId, codigoTicket, dataAbertura, slaMinutosRestantes, slaSegundosRestantes, slaMinutosTotais, tempoPausadoTotal, status, slaPausado, slaPausadoMensagem, slaPausadoHorario, onSLAExpired, toast]);

  if (slaMinutosRestantes == null || status === 'concluido') {
    return null;
  }

  const formatTime = (value: number) => value.toString().padStart(2, '0');

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
    const minutosVencidos = Math.abs(slaMinutosRestantes || 0);
    const horasVencidas = Math.floor(minutosVencidos / 60);
    const minutosRestantes = minutosVencidos % 60;
    
    let overdueText = 'SLA Vencido há ';
    if (horasVencidas > 0) {
      overdueText += `${horasVencidas}h`;
      if (minutosRestantes > 0) {
        overdueText += ` ${minutosRestantes}min`;
      }
    } else {
      overdueText += `${minutosVencidos} minutos`;
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
    <div className={`text-sm font-mono ${getSLAColor()}`}>
      {timeRemaining.hours > 0 && `${formatTime(timeRemaining.hours)}:`}
      {formatTime(timeRemaining.minutes)}:{formatTime(timeRemaining.seconds)} restantes
    </div>
  );
};
