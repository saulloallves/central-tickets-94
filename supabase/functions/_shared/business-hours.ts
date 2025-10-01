/**
 * Business hours utility function
 * Returns true if current time is within business hours (Monday-Saturday, 8h30-20h00, SP timezone)
 */
export function isBusinessHours(): boolean {
  try {
    // Get current time in São Paulo timezone
    const now = new Date();
    const spTime = new Date(now.toLocaleString("en-US", {timeZone: "America/Sao_Paulo"}));
    
    const dayOfWeek = spTime.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    const hour = spTime.getHours();
    const minutes = spTime.getMinutes();
    
    // Monday to Saturday (1-6), 8h30 to 20h00
    const isWorkday = dayOfWeek >= 1 && dayOfWeek <= 6;
    const timeInMinutes = hour * 60 + minutes;
    const startTime = 8 * 60 + 30; // 8h30 = 510 minutes
    const endTime = 20 * 60; // 20h00 = 1200 minutes
    const isWorkingHour = timeInMinutes >= startTime && timeInMinutes < endTime;
    
    return isWorkday && isWorkingHour;
  } catch (error) {
    console.error("Erro ao verificar horário de funcionamento:", error);
    // Em caso de erro, considerar como fora do horário por segurança
    return false;
  }
}