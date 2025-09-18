// Mapeamento de mensagens de erro de autenticação para português
export const authErrorMessages: Record<string, string> = {
  // Login errors
  'Invalid login credentials': 'Email ou senha incorretos',
  'Email not confirmed': 'Email não confirmado. Verifique sua caixa de entrada.',
  'Too many requests': 'Muitas tentativas. Tente novamente em alguns minutos.',
  'User not found': 'Usuário não encontrado',
  'Invalid email or password': 'Email ou senha inválidos',
  'Wrong email or password': 'Email ou senha incorretos',
  'Password is too weak': 'A senha é muito fraca',
  'Password should be at least 6 characters': 'A senha deve ter pelo menos 6 caracteres',
  
  // Signup errors
  'User already registered': 'Este email já está cadastrado',
  'Email already exists': 'Este email já está em uso',
  'Email address is invalid': 'Endereço de email inválido',
  'Password is too short': 'A senha é muito curta',
  'Signup disabled': 'Cadastro desabilitado',
  'Email rate limit exceeded': 'Limite de emails excedido. Tente novamente mais tarde.',
  
  // Password reset errors
  'Unable to validate email address: invalid format': 'Formato de email inválido',
  'For security purposes, you can only request this once every 60 seconds': 'Por segurança, você só pode solicitar isso uma vez a cada 60 segundos',
  
  // Network errors
  'Failed to fetch': 'Erro de conexão. Verifique sua internet.',
  'Network request failed': 'Falha na conexão de rede',
  'fetch error': 'Erro de conexão',
  
  // General errors
  'Request timeout': 'Tempo limite excedido',
  'Service temporarily unavailable': 'Serviço temporariamente indisponível',
  'Internal server error': 'Erro interno do servidor',
  'Bad request': 'Solicitação inválida',
  'Unauthorized': 'Não autorizado',
  'Forbidden': 'Acesso negado',
  
  // JWT/Token errors
  'JWT expired': 'Sessão expirada. Faça login novamente.',
  'Invalid JWT': 'Sessão inválida. Faça login novamente.',
  'Token has expired': 'Token expirado. Faça login novamente.',
  'Invalid token': 'Token inválido. Faça login novamente.',
  
  // Database errors (que podem aparecer em auth)
  'duplicate key value violates unique constraint': 'Este email já está cadastrado no sistema',
  'permission denied': 'Permissão negada',
  
  // MFA errors (se implementado)
  'MFA challenge failed': 'Falha na autenticação de dois fatores',
  'Invalid MFA code': 'Código de autenticação inválido',
  
  // OAuth errors (se implementado)
  'OAuth state mismatch': 'Erro de autenticação OAuth',
  'OAuth provider error': 'Erro do provedor de autenticação',
};

/**
 * Traduz uma mensagem de erro de autenticação para português
 * @param error - O erro retornado pelo Supabase
 * @returns Mensagem de erro em português
 */
export function translateAuthError(error: any): string {
  if (!error) return 'Erro desconhecido';
  
  const message = error.message || error.msg || String(error);
  
  // Procura por uma tradução exata
  if (authErrorMessages[message]) {
    return authErrorMessages[message];
  }
  
  // Procura por correspondências parciais para mensagens mais complexas
  for (const [englishMsg, portugueseMsg] of Object.entries(authErrorMessages)) {
    if (message.toLowerCase().includes(englishMsg.toLowerCase())) {
      return portugueseMsg;
    }
  }
  
  // Se não encontrou tradução, retorna uma mensagem genérica em português
  console.warn('Mensagem de erro não traduzida:', message);
  
  // Mensagens genéricas baseadas no tipo de erro
  if (message.toLowerCase().includes('password')) {
    return 'Erro relacionado à senha. Verifique os dados informados.';
  }
  
  if (message.toLowerCase().includes('email')) {
    return 'Erro relacionado ao email. Verifique o endereço informado.';
  }
  
  if (message.toLowerCase().includes('network') || message.toLowerCase().includes('fetch')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente.';
  }
  
  if (message.toLowerCase().includes('rate limit') || message.toLowerCase().includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  
  // Fallback para mensagem original se não conseguiu traduzir
  return message;
}