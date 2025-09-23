# Templates para Criação de Tickets

## 1. Endpoint: `typebot-webhook`
**URL**: `https://hryurntaljdisohawpqf.supabase.co/functions/v1/typebot-webhook`

### Template Básico (com nome da equipe)
```json
{
  "message": "Sistema não está funcionando corretamente",
  "codigo_unidade": "001",
  "equipe_responsavel_nome": "Suporte Técnico",
  "force_create": true
}
```

### Template Completo (com nome da equipe)
```json
{
  "message": "Problema crítico no sistema de vendas",
  "codigo_unidade": "001",
  "equipe_responsavel_nome": "Desenvolvimento",
  "categoria": "sistema",
  "prioridade": "alto",
  "titulo": "Falha sistema vendas",
  "user": {
    "web_password": "123456"
  },
  "force_create": true,
  "attachments": [
    {
      "url": "https://example.com/screenshot.jpg",
      "type": "image"
    }
  ]
}
```

## 2. Endpoint: `create-ticket`
**URL**: `https://hryurntaljdisohawpqf.supabase.co/functions/v1/create-ticket`
**Requer**: Header `Authorization: Bearer <seu_jwt_token>`

### Template Básico (com nome da equipe)
```json
{
  "unidade_id": "001",
  "descricao_problema": "Sistema não está funcionando corretamente",
  "equipe_responsavel_nome": "Suporte Técnico"
}
```

### Template Completo (com nome da equipe)
```json
{
  "unidade_id": "001",
  "titulo": "Falha no Sistema",
  "descricao_problema": "Sistema de vendas apresentando erro crítico",
  "equipe_responsavel_nome": "Desenvolvimento",
  "categoria": "sistema",
  "subcategoria": "erro_critico",
  "prioridade": "alto",
  "canal_origem": "api",
  "arquivos": [
    {
      "nome": "screenshot.jpg",
      "url": "https://example.com/screenshot.jpg",
      "tipo": "image/jpeg"
    }
  ]
}
```

## Campos Opcionais

### Prioridades Válidas
- `"baixo"` (padrão)
- `"medio"`
- `"alto"`
- `"imediato"`
- `"crise"`

### Categorias Comuns
- `"sistema"`
- `"suporte"`
- `"financeiro"`
- `"vendas"`
- `"outro"` (padrão)

### Canais de Origem
- `"web"` (padrão para create-ticket)
- `"typebot"` (padrão para typebot-webhook)
- `"whatsapp"`
- `"email"`
- `"telefone"`
- `"api"`

## Notas Importantes

1. **Nomes de Equipe**: O sistema busca primeiro por correspondência exata, depois por correspondência parcial
2. **Prioridade do ID**: Se tanto `equipe_responsavel_id` quanto `equipe_responsavel_nome` forem fornecidos, o ID terá prioridade
3. **Validação**: O sistema validará se a equipe existe e está ativa
4. **Fallback**: Se a equipe não for encontrada, retornará erro específico

## Exemplos de Resposta

### Sucesso (typebot-webhook)
```json
{
  "success": true,
  "action": "ticket_created",
  "ticket": {
    "id": "uuid",
    "codigo_ticket": "001-2024-0001",
    "titulo": "Falha sistema vendas",
    "categoria": "sistema",
    "prioridade": "alto",
    "status": "aberto",
    "data_abertura": "2024-01-01T10:00:00Z",
    "equipe_responsavel_id": "uuid-equipe",
    "equipe_responsavel_nome": "Desenvolvimento"
  },
  "ai_analysis": { ... },
  "message": "Ticket 001-2024-0001 criado com sucesso"
}
```

### Erro (equipe não encontrada)
```json
{
  "success": false,
  "error": "Equipe \"Nome Inexistente\" não encontrada ou inativa"
}
```