// @ts-nocheck
/**
 * Advanced AI Classifier Settings and Utilities
 * Provides dynamic AI classification based on user-configured settings
 */

export interface AdvancedSettings {
  priority_matrix: {
    baixo: { urgencia: string; impacto: string; sla_minutos: number };
    medio: { urgencia: string; impacto: string; sla_minutos: number };
    alto: { urgencia: string; impacto: string; sla_minutos: number };
    imediato: { urgencia: string; impacto: string; sla_minutos: number };
    crise: { urgencia: string; impacto: string; sla_minutos: number };
  };
  emergency_keywords: string[];
  load_balancing: {
    enabled: boolean;
    team_weights: Record<string, number>;
  };
  ai_model_settings: {
    classification_model?: string;
    classification_temperature?: number;
    classification_max_tokens?: number;
  };
}

/**
 * Fetch advanced classifier settings from database
 */
export async function getAdvancedSettings(supabase: any): Promise<AdvancedSettings | null> {
  try {
    const { data, error } = await supabase
      .from('ai_classifier_advanced_settings')
      .select('*')
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching advanced settings:', error);
      return null;
    }
    
    if (!data) {
      console.log('No advanced classifier settings found - using defaults');
      return null;
    }
    
    console.log('✅ Advanced classifier settings loaded:', {
      has_priority_matrix: !!data.priority_matrix,
      emergency_keywords_count: data.emergency_keywords?.length || 0,
      load_balancing_enabled: data.load_balancing?.enabled || false,
      has_custom_model: !!data.ai_model_settings?.classification_model
    });
    
    return data as AdvancedSettings;
  } catch (error) {
    console.error('Exception fetching advanced settings:', error);
    return null;
  }
}

/**
 * Detect emergency keywords in text
 */
export function detectEmergencyKeywords(text: string, keywords: string[]): boolean {
  if (!keywords || keywords.length === 0) {
    return false;
  }
  
  const lowerText = text.toLowerCase();
  const detected = keywords.some(keyword => 
    lowerText.includes(keyword.toLowerCase())
  );
  
  if (detected) {
    console.log('🚨 Emergency keyword detected in text');
  }
  
  return detected;
}

/**
 * Build advanced classification prompt with ITIL matrix and team info
 */
export function buildAdvancedPrompt(
  baseMessage: string,
  settings: AdvancedSettings,
  equipes: any[]
): string {
  // Build priority matrix description
  const priorityDescriptions = Object.entries(settings.priority_matrix)
    .map(([level, criteria]) => 
      `   - ${level}: ${criteria.urgencia} + ${criteria.impacto} (SLA: ${criteria.sla_minutos}min)`
    )
    .join('\n');

  // Build team info with load balancing weights if enabled
  let teamInfo = '';
  if (settings.load_balancing?.enabled) {
    teamInfo = equipes.map(e => {
      const weight = settings.load_balancing.team_weights?.[e.id] || 1;
      let capacityNote = '';
      if (weight > 1) {
        capacityNote = ' ⚡ (Alta capacidade - priorize)';
      } else if (weight < 1) {
        capacityNote = ' ⚠️ (Capacidade limitada - evite se possível)';
      }
      return `- ID: ${e.id} | Nome: ${e.nome}${capacityNote}\n  Especialidade: ${e.introducao || 'Sem especialidades'}`;
    }).join('\n\n');
  } else {
    teamInfo = equipes.map(e => 
      `- ID: ${e.id} | Nome: ${e.nome}\n  Especialidade: ${e.introducao || 'Sem especialidades'}`
    ).join('\n\n');
  }

  // Build emergency keywords section
  const emergencySection = settings.emergency_keywords.length > 0 ? `

⚠️ PALAVRAS DE EMERGÊNCIA (ao detectar, escalar para 'imediato' ou 'crise'):
${settings.emergency_keywords.join(', ')}

Se qualquer dessas palavras estiver presente, priorize 'imediato' ou 'crise' conforme gravidade.
` : '';

  return `
Você é um especialista em classificação de tickets de suporte técnico da Cresci & Perdi.

Analise este ticket usando a MATRIZ DE PRIORIDADE ITIL configurada:

📊 MATRIZ DE PRIORIDADE (Urgência × Impacto):
${priorityDescriptions}
${emergencySection}
🏢 EQUIPES DISPONÍVEIS:
${teamInfo}

📝 MENSAGEM DO TICKET: "${baseMessage}"

Analise e forneça:

1. TÍTULO: Crie um título DESCRITIVO de exatamente 3 palavras que resuma o problema principal.
2. PRIORIDADE: Use a matriz ITIL acima para classificar (baixo, medio, alto, imediato, crise)
3. EQUIPE SUGERIDA: Retorne o UUID da equipe mais adequada${settings.load_balancing?.enabled ? ' (considere capacidade)' : ''}

Responda APENAS em JSON válido:
{
  "prioridade": "uma_das_5_opcoes",
  "titulo": "Título de 3 palavras",
  "equipe_sugerida": "UUID_da_equipe",
  "justificativa": "Explicação baseada na matriz ITIL e especialidades",
  "confianca": "alta|media|baixa",
  "emergency_detected": true|false
}

REGRAS CRÍTICAS:
- Use APENAS: baixo, medio, alto, imediato, crise
- Retorne UUID completo da equipe
- Base-se na matriz ITIL fornecida
- Detecte palavras de emergência se listadas
`;
}
