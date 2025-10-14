import { toZonedTime } from 'npm:date-fns-tz@3.2.0';

/**
 * Business hours utility function
 * Returns true if current time is within business hours (Monday-Saturday, 8h30-17h30, SP timezone)
 */
export function isBusinessHours(): boolean {
  try {
    // Get current time in São Paulo timezone using date-fns-tz
    const now = new Date();
    const spTime = toZonedTime(now, 'America/Sao_Paulo');
    
    const dayOfWeek = spTime.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const hour = spTime.getHours();
    const minutes = spTime.getMinutes();
    
    // Monday to Saturday (1-6), 8h30 to 17h30
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 6;
    const timeInMinutes = hour * 60 + minutes;
    const startTime = 8 * 60 + 30; // 8h30 = 510 minutes
    const endTime = 17 * 60 + 30; // 17h30 = 1050 minutes
    const isWorkingHour = timeInMinutes >= startTime && timeInMinutes < endTime;
    
    return isWorkday && isWorkingHour;
  } catch (error) {
    console.error("Erro ao verificar horário de funcionamento:", error);
    // Em caso de erro, considerar como fora do horário por segurança
    return false;
  }
}

/**
 * Returns the next business hour start (8h30) in São Paulo timezone
 */
export function getNextBusinessHourStart(): Date {
  const now = new Date();
  const spTime = toZonedTime(now, 'America/Sao_Paulo');
  
  const dayOfWeek = spTime.getDay();
  const hour = spTime.getHours();
  const minutes = spTime.getMinutes();
  const timeInMinutes = hour * 60 + minutes;
  const startTime = 8 * 60 + 30; // 8h30
  
  // If it's Sunday (0), go to Monday 8h30
  if (dayOfWeek === 0) {
    const nextStart = new Date(spTime);
    nextStart.setDate(nextStart.getDate() + 1);
    nextStart.setHours(8, 30, 0, 0);
    return nextStart;
  }
  
  // If it's Saturday after hours, go to Monday 8h30
  if (dayOfWeek === 6 && timeInMinutes >= startTime) {
    const nextStart = new Date(spTime);
    nextStart.setDate(nextStart.getDate() + 2);
    nextStart.setHours(8, 30, 0, 0);
    return nextStart;
  }
  
  // If it's before 8h30 today, return today 8h30
  if (timeInMinutes < startTime) {
    const nextStart = new Date(spTime);
    nextStart.setHours(8, 30, 0, 0);
    return nextStart;
  }
  
  // Otherwise, return next day 8h30
  const nextStart = new Date(spTime);
  nextStart.setDate(nextStart.getDate() + 1);
  nextStart.setHours(8, 30, 0, 0);
  return nextStart;
}

/**
 * Returns the next business hour end (17h30) in São Paulo timezone
 */
export function getNextBusinessHourEnd(): Date {
  const now = new Date();
  const spTime = toZonedTime(now, 'America/Sao_Paulo');
  
  const dayOfWeek = spTime.getDay();
  const endTime = 17 * 60 + 30; // 17h30
  
  // If it's Sunday, go to Monday 17h30
  if (dayOfWeek === 0) {
    const nextEnd = new Date(spTime);
    nextEnd.setDate(nextEnd.getDate() + 1);
    nextEnd.setHours(17, 30, 0, 0);
    return nextEnd;
  }
  
  // If it's Saturday, go to Monday 17h30
  if (dayOfWeek === 6) {
    const nextEnd = new Date(spTime);
    nextEnd.setDate(nextEnd.getDate() + 2);
    nextEnd.setHours(17, 30, 0, 0);
    return nextEnd;
  }
  
  // Otherwise, return today 17h30
  const nextEnd = new Date(spTime);
  nextEnd.setHours(17, 30, 0, 0);
  return nextEnd;
}

/**
 * Calculates total paused time between two dates, skipping weekends
 */
export function calculatePausedTime(pausedAt: Date, resumedAt: Date): number {
  let totalMinutes = 0;
  const current = new Date(pausedAt);
  
  while (current < resumedAt) {
    const dayOfWeek = current.getDay();
    
    // Skip Sundays
    if (dayOfWeek === 0) {
      current.setDate(current.getDate() + 1);
      current.setHours(0, 0, 0, 0);
      continue;
    }
    
    const nextDay = new Date(current);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    
    const endOfPeriod = nextDay < resumedAt ? nextDay : resumedAt;
    const diffMs = endOfPeriod.getTime() - current.getTime();
    totalMinutes += Math.floor(diffMs / 1000 / 60);
    
    current.setTime(endOfPeriod.getTime());
  }
  
  return totalMinutes;
}

/**
 * Checks if current time is within 30 minutes before business hour end
 */
export function isNearBusinessHourEnd(): boolean {
  try {
    const now = new Date();
    const spTime = toZonedTime(now, 'America/Sao_Paulo');
    
    const dayOfWeek = spTime.getDay();
    const hour = spTime.getHours();
    const minutes = spTime.getMinutes();
    const timeInMinutes = hour * 60 + minutes;
    
    // Only check on workdays
    if (dayOfWeek < 1 || dayOfWeek > 6) return false;
    
    const endTime = 17 * 60 + 30; // 17h30
    const threshold = endTime - 30; // 17h00
    
    return timeInMinutes >= threshold && timeInMinutes < endTime;
  } catch (error) {
    console.error("Erro ao verificar proximidade do fim do expediente:", error);
    return false;
  }
}