export function normalizePhone(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');
  
  // If it starts with 55 (Brazil), keep as is
  if (cleaned.startsWith('55')) {
    return cleaned;
  }
  
  // If it doesn't start with country code, assume Brazil (55)
  if (cleaned.length >= 10) {
    return `55${cleaned}`;
  }
  
  return cleaned;
}

export function formatResponseForFranqueado(aiResponse: string): string {
  // Remove markdown citations like [Fonte 1], [Fonte 2], etc.
  let formatted = aiResponse.replace(/\[Fonte \d+\]/g, '');
  
  // Remove excessive markdown formatting
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '$1'); // Remove bold
  formatted = formatted.replace(/\*(.*?)\*/g, '$1'); // Remove italic
  
  // Remove common greetings/closings for more direct responses
  formatted = formatted.replace(/^(Olá|Oi|Bom dia|Boa tarde|Boa noite)[,!]?\s*/i, '');
  formatted = formatted.replace(/\s*(Att|Atenciosamente|Abraços|Obrigado)[.,]?\s*$/i, '');
  
  // Clean up extra whitespace
  formatted = formatted.replace(/\s+/g, ' ').trim();
  
  return formatted;
}

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
