import { formatDistanceToNow, format } from 'date-fns';
import { formatInTimeZone } from 'date-fns-tz';
import { ptBR } from 'date-fns/locale';

const SAO_PAULO_TIMEZONE = 'America/Sao_Paulo';

export function formatDistanceToNowInSaoPaulo(date: Date | string, options?: { addSuffix?: boolean }) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // Criar uma data no timezone de São Paulo para comparação
  const now = new Date();
  const saoPauloDate = new Date(formatInTimeZone(dateObj, SAO_PAULO_TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));
  const saoPauloNow = new Date(formatInTimeZone(now, SAO_PAULO_TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));
  
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
  return new Date(formatInTimeZone(dateObj, SAO_PAULO_TIMEZONE, 'yyyy-MM-dd HH:mm:ss'));
}