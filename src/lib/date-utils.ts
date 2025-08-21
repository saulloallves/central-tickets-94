import { formatDistanceToNow, format } from 'date-fns';
import { formatInTimeZone, toZonedTime, fromZonedTime } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

export function formatDistanceToNowInSaoPaulo(date: Date | string, options?: { addSuffix?: boolean }) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Usar o tempo atual corretamente
  return formatDistanceToNow(dateObj, {
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
  
  const diffMs = target.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  
  return {
    minutes: diffMinutes,
    isOverdue: diffMinutes < 0,
    hours: Math.floor(Math.abs(diffMinutes) / 60),
    remainingMinutes: Math.abs(diffMinutes) % 60
  };
}

export function getBusinessShiftStart(date?: Date) {
  const targetDate = date ? getSaoPauloDate(date) : getSaoPauloDate();
  // Set to 8:30 AM
  targetDate.setHours(8, 30, 0, 0);
  return targetDate;
}

export function isFromPreviousBusinessDay(ticketDate: Date | string) {
  const ticket = getSaoPauloDate(ticketDate);
  const today = new Date();
  const todayShiftStart = getBusinessShiftStart(today);
  
  return ticket < todayShiftStart;
}