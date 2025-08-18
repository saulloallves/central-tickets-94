import { formatDistanceToNow, format } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

export function formatDistanceToNowInSaoPaulo(date: Date | string, options?: { addSuffix?: boolean }) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Converter a data para o timezone de São Paulo
  const saoPauloDate = toZonedTime(dateObj, SAO_PAULO_TIMEZONE);
  const now = new Date();
  const saoPauloNow = toZonedTime(now, SAO_PAULO_TIMEZONE);
  
  return formatDistanceToNow(saoPauloDate, {
    addSuffix: options?.addSuffix || false,
    locale: ptBR
  });
}

export function formatDateInSaoPaulo(date: Date | string, formatStr: string = 'dd/MM/yyyy HH:mm') {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(dateObj, SAO_PAULO_TIMEZONE, formatStr, { locale: ptBR });
}

export function formatDateTimeBR(date: Date | string) {
  return formatDateInSaoPaulo(date, 'dd/MM/yyyy HH:mm');
}

export function formatDateBR(date: Date | string) {
  return formatDateInSaoPaulo(date, 'dd/MM/yyyy');
}

export function formatTimeBR(date: Date | string) {
  return formatDateInSaoPaulo(date, 'HH:mm');
}

export function getSaoPauloDate(date?: Date | string) {
  const dateObj = date ? (typeof date === 'string' ? new Date(date) : date) : new Date();
  return toZonedTime(dateObj, SAO_PAULO_TIMEZONE);
}

export function calculateTimeRemaining(targetDate: Date | string) {
  const target = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  const now = new Date();
  
  // Converter ambas as datas para São Paulo
  const saoPauloTarget = toZonedTime(target, SAO_PAULO_TIMEZONE);
  const saoPauloNow = toZonedTime(now, SAO_PAULO_TIMEZONE);
  
  const diffMs = saoPauloTarget.getTime() - saoPauloNow.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  
  return {
    minutes: diffMinutes,
    isOverdue: diffMinutes < 0,
    hours: Math.floor(Math.abs(diffMinutes) / 60),
    remainingMinutes: Math.abs(diffMinutes) % 60
  };
}