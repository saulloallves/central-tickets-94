# Sistema de Alertas para Assistentes de IA

## Visão Geral

Sistema automático de monitoramento e alertas para todas as integrações de IA do sistema. Detecta falhas, erros e problemas de performance, enviando alertas imediatos via WhatsApp para a equipe técnica.

## Edge Functions Integradas

### ✅ **Integração Completa**
- `ai-alert-system` - Sistema central de alertas
- `suggest-reply` - Sugestões RAG para tickets
- `faq-suggest` - Sugestões FAQ  
- `ticket-ai-chat` - Chat com IA nos tickets
- `kb-create-memory` - Criação de memórias KB
- `regenerate-embeddings` - Regeneração de embeddings

### 🔄 **Integração Parcial**
- `typebot-webhook/ai-classifier` - Classificação de tickets (wrapper adicionado)
- `zapi-whatsapp/rag-engine` - RAG WhatsApp (rerank monitorado)

### ⚠️ **Pendente Integração**
- `analyze-ticket` - Análise de tickets
- `crises-ai-analyst` - Análise de crises
- `kb-upsert-document` - Upsert de documentos

## Como Funciona

### 1. Detecção Automática de Erros
```typescript
export function detectErrorType(error: any, response?: any): ErrorType {
  // Detecta automaticamente:
  // - token_limit: Limite de tokens atingido
  // - rate_limit: Limite de taxa (429)
  // - timeout: Timeout (408)
  // - internal_error: Erros 5xx
  // - api_error: Erros 4xx
  // - no_response: Resposta vazia
}
```

### 2. Wrapper de Monitoramento
```typescript
const result = await wrapAIFunction(
  'AssistantName-AI',           // Nome do assistente
  'function/location/method',   // Local do erro
  async () => {
    // Sua função de IA aqui
    return await aiApiCall();
  },
  ticketId,                     // ID do ticket (opcional)
  userId,                       // ID do usuário (opcional)
  requestPayload               // Dados da requisição (opcional)
);
```

### 3. Envio de Alertas
- **Destino**: Unidade "TESTES DO MAKE / RJ" (`id_grupo_branco`)
- **Canal**: WhatsApp via Z-API
- **Formato**: Mensagem estruturada com emojis
- **Logs**: Salvos em `logs_de_sistema`

## Exemplo de Implementação

### Frontend (Hooks)
```typescript
// src/hooks/useAISuggestion.tsx
import { useAIAlertSystem } from '@/hooks/useAIAlertSystem';

const { wrapAIFunction } = useAIAlertSystem();

const data = await wrapAIFunction(
  'SuggestReply-RAG',
  'hooks/useAISuggestion/generateSuggestion',
  async () => {
    const { data, error } = await supabase.functions.invoke('suggest-reply', {
      body: { ticketId }
    });
    if (error) throw error;
    return data;
  },
  ticketId,
  undefined,
  { ticketId }
);
```

### Edge Functions
```typescript
// supabase/functions/my-ai-function/index.ts
import { wrapAIFunction } from '../_shared/ai-alert-utils.ts';

const result = await wrapAIFunction(
  'MyAI-Assistant',
  'my-ai-function/generateResponse',
  async () => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      // ... configuração da API
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content;
  },
  ticketId,
  userId,
  requestPayload
);
```

## Tipos de Erro Monitorados

| Tipo | Descrição | Emoji | Ação Sugerida |
|------|-----------|-------|----------------|
| `token_limit` | Limite de tokens atingido | 📊 | Reduzir tamanho do prompt |
| `rate_limit` | Limite de taxa excedido | ⏱️ | Implementar retry com delay |
| `internal_error` | Erro interno da API | 💥 | Verificar logs da API |
| `no_response` | Sem resposta da IA | 🔇 | Verificar conectividade |
| `api_error` | Erro de conexão/autenticação | 🔌 | Verificar credenciais |
| `timeout` | Timeout na requisição | ⏰ | Aumentar timeout ou otimizar prompt |

## Configuração

### Unidade de Destino
- **Nome**: TESTES DO MAKE / RJ  
- **Campo**: `unidades.id_grupo_branco`
- **Busca**: ILIKE '%TESTES%MAKE%' ou '%MAKE%RJ%'

### Z-API
- **Configuração**: `messaging_providers` table
- **Provider**: `zapi`
- **Status**: `is_active = true`

## Exemplo de Alerta

```
🚨 *ALERTA CRÍTICO DE IA* 🚨

🤖 *Assistente:* SuggestReply-RAG
📊 *Erro:* Limite de Tokens Atingido
📍 *Local:* hooks/useAISuggestion/generateSuggestion
🕒 *Horário:* 06/09/2025 15:42

📄 *Detalhes do Erro:*
O assistente atingiu o limite máximo de tokens durante a geração de resposta.

🎫 *Ticket:* abc-123-def
👤 *Usuário:* user-uuid

⚠️ *Ação necessária:* Verificar configurações e tamanho do prompt
```

## Interface de Teste

**Localização**: Admin → Configurações → Alertas IA

### Funcionalidades
- ✅ Teste manual de alertas
- ✅ Testes pré-definidos (Token Limit, Rate Limit, etc.)
- ✅ Configuração personalizada de alertas
- ✅ Preview da mensagem
- ✅ Status de envio

### Testes Pré-definidos
1. **Token Limit** - Simula limite de tokens
2. **Rate Limit** - Simula limite de taxa
3. **No Response** - Simula resposta vazia
4. **Timeout** - Simula timeout

## Próximos Passos

### 1. Completar Integração
- [ ] `analyze-ticket` - Adicionar wrapper de alerta
- [ ] `crises-ai-analyst` - Monitorar análise de crises  
- [ ] `kb-upsert-document` - Alertas para processamento de documentos
- [ ] `typebot-webhook` - Integração completa do classificador

### 2. Melhorias
- [ ] Dashboard de alertas em tempo real
- [ ] Métricas de performance dos assistentes
- [ ] Alertas por email (backup)
- [ ] Configuração de thresholds por assistente
- [ ] Histórico de alertas e resolução

### 3. Monitoramento Avançado
- [ ] Latência dos assistentes
- [ ] Taxa de sucesso por modelo
- [ ] Consumo de tokens por assistente
- [ ] Alertas de degradação de performance

## Logs de Sistema

Todos os alertas são registrados em `logs_de_sistema`:
- **tipo_log**: `sistema`
- **entidade_afetada**: `ai_assistants`
- **entidade_id**: Nome do assistente
- **acao_realizada**: Descrição do alerta
- **dados_novos**: Payload completo do alerta