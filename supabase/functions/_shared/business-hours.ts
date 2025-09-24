/**
 * Business hours utility function
 * Returns true if current time is within business hours (Monday-Saturday, 9h-18h, SP timezone)
 */
export function isBusinessHours(): boolean {
  try {
    // Get current time in São Paulo timezone
    const now = new Date();
    const spTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    
    const dayOfWeek = spTime.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const hour = spTime.getHours();
    
    // Monday to Saturday (1-6), 9h to 18h
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 6;
    const isWorkingHour = hour >= 9 && hour < 18;
    
    return isWorkday && isWorkingHour;
  } catch (error) {
    console.error("Erro ao verificar horário de funcionamento:", error);
    // Em caso de erro, considerar como fora do horário por segurança
    return false;
  }
}