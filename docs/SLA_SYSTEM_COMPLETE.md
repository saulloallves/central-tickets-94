# 📋 Sistema de SLA - Implementação Completa

## 🎯 Visão Geral

Sistema de gerenciamento de Service Level Agreement (SLA) com:
- ✅ Cálculo automático de tempo pausado via trigger de banco de dados
- ✅ Sincronização em tempo real entre backend e frontend
- ✅ Múltiplas flags de pausa (manual, mensagem, horário comercial)
- ✅ Timer frontend com resincronização automática a cada 10s
- ✅ Painel de debug para testes e troubleshooting

---

## 🏗️ Arquitetura

### Backend (Fonte de Verdade)
```
┌─────────────────────────────────────────┐
│  Trigger: acumular_tempo_pausado()      │
│  - Detecta mudanças em flags de pausa   │
│  - Acumula tempo automaticamente        │
│  - Atualiza tempo_pausado_total         │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  Function: calcular_sla_tempo_real()    │
│  - Calcula: SLA total - decorrido +     │
│             tempo pausado               │
│  - Retorna: sla_minutos_restantes       │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  View: tickets_with_realtime_sla        │
│  - Expõe SLA já calculado para frontend │
│  - sla_minutos_restantes_calculado      │
└─────────────────────────────────────────┘
```

### Frontend (Exibição)
```
┌─────────────────────────────────────────┐
│  useSimpleTickets                       │
│  - Busca da view (SLA calculado)        │
│  - Escuta realtime de pausas            │
└─────────────────────────────────────────┘
           ↓
┌─────────────────────────────────────────┐
│  sla-timer-manager.ts                   │
│  - Decrementa localmente (UI smooth)    │
│  - Resincroniza a cada 10s              │
│  - Para quando pausado                  │
└─────────────────────────────────────────┘
```

---

## 🎛️ Flags de Pausa

### 1. `sla_pausado` (Pausa Manual)
- **Quando ativa**: Atendente pausou manualmente
- **Como pausar**: Botão "Pausar SLA" ou painel de debug
- **Como despausar**: Botão "Retomar SLA"
- **Ícone**: ⏸️

### 2. `sla_pausado_mensagem` (Pausa Automática)
- **Quando ativa**: Cliente/franqueado enviou mensagem
- **Como pausar**: Automaticamente via trigger
- **Como despausar**: Atendente responde
- **Ícone**: 💬

### 3. `sla_pausado_horario` (Horário Comercial)
- **Quando ativa**: Fora do horário de expediente
- **Como pausar**: Edge function via cron
- **Como despausar**: Edge function via cron
- **Ícone**: 🕐

**REGRA**: Se QUALQUER flag = `true`, SLA não decrementa

---

## 📐 Fórmula de Cálculo

```typescript
SLA Restante = SLA Total - Tempo Decorrido + Tempo Pausado
```

### Exemplo Prático

**Cenário**: Ticket com SLA de 400 minutos
- **10:00** - Ticket aberto
- **10:30** - Cliente responde (SLA pausa) → 30 min decorridos
- **11:00** - Atendente responde (SLA retoma) → 30 min pausados
- **12:00** - Agora (mais 60 min decorridos)

**Cálculo**:
```
Tempo decorrido total: 120 min (10:00 → 12:00)
Tempo pausado:         30 min  (10:30 → 11:00)
SLA restante:          400 - 120 + 30 = 310 minutos ✅
```

---

## 🔄 Fluxo de Sincronização

### 1. Ticket é Pausado
```
1. Flag muda no banco (ex: sla_pausado_mensagem = true)
   ↓
2. Trigger registra: ultima_pausa_timestamp = now()
   ↓
3. Realtime notifica frontend
   ↓
4. Timer frontend para de decrementar
   ↓
5. UI mostra "Pausado - Aguardando resposta"
```

### 2. Ticket é Despausado
```
1. Flag muda no banco (ex: sla_pausado_mensagem = false)
   ↓
2. Trigger calcula: tempo_pausado_total += (now() - ultima_pausa_timestamp)
   ↓
3. View recalcula: sla_minutos_restantes com nova pausa acumulada
   ↓
4. Realtime notifica frontend com novo valor
   ↓
5. Timer frontend resincroniza e continua decrementando
```

---

## 🧪 Como Testar

### 1. Abrir Painel de Debug
1. Abrir qualquer ticket em ambiente de desenvolvimento
2. Painel de debug aparece automaticamente abaixo do timer SLA
3. Mostra todas as flags, métricas e validação da fórmula

### 2. Testar Pausa Manual
1. Clicar em "Pausar SLA" no painel de debug
2. Verificar que timer para de decrementar
3. Verificar log no console: `⏸️ [FASE 2] SLA Pausado mudou: false → true`
4. Clicar em "Retomar SLA"
5. Verificar que timer volta a decrementar

### 3. Testar Múltiplas Abas
1. Abrir mesmo ticket em 2 abas do navegador
2. Pausar em uma aba
3. Verificar que ambas atualizam instantaneamente via realtime

### 4. Testar Acúmulo de Tempo
1. Ver "Tempo Pausado" no painel de debug (inicialmente 0)
2. Pausar por 1 minuto
3. Despausar
4. Verificar que "Tempo Pausado" aumentou ~1 min
5. Verificar que fórmula bate: `SLA Total - Decorrido + Pausado = SLA Restante`

---

## 🛠️ Arquivos Principais

### Backend
- `supabase/migrations/*_fase1.sql` - Trigger e função de cálculo
- `supabase/functions/pause-sla-processor/` - Pausa por horário

### Frontend
- `src/lib/sla-timer-manager.ts` - Gerenciador central de timers
- `src/lib/sla-flags-documentation.ts` - Documentação das flags
- `src/hooks/useSimpleTickets.tsx` - Busca da view com SLA calculado
- `src/hooks/useSimpleTicketsRealtime.tsx` - Realtime com foco em pausas
- `src/components/tickets/SLADebugPanel.tsx` - Painel de testes

---

## 🐛 Troubleshooting

### ❌ Timer não para quando pausa
**Causa**: Realtime não está funcionando  
**Solução**: Verificar logs no console. Deve aparecer `📡 [FASE 2] SLA Pausado mudou`

### ❌ Tempo pausado não acumula
**Causa**: Trigger não está ativo  
**Solução**: Verificar no Supabase SQL Editor:
```sql
SELECT * FROM pg_trigger WHERE tgname = 'trigger_acumular_tempo_pausado';
```

### ❌ SLA vence mesmo pausado
**Causa**: Backend calcula antes de frontend  
**Solução**: Verificar `sla_minutos_restantes` na view `tickets_with_realtime_sla`

### ❌ Timer dessincronizado
**Causa**: Frontend e backend temporariamente diferentes  
**Solução**: Aguardar 10s (resincronização automática) ou clicar "Ressincronizar"

---

## 📊 Monitoramento

### Logs para Acompanhar

```javascript
// FASE 1: Backend
"⏱️ [FASE 1] Iniciando timer do ticket X: SLA restante (backend): Y min"
"⏱️ [FASE 1] Ressincronizado X: A min → B min"

// FASE 2: Realtime
"📡 [FASE 2] Realtime event: UPDATE"
"⏸️ [FASE 2] SLA Pausado mudou: false → true"
"💬 [FASE 2] SLA Pausado Mensagem mudou: false → true"
"✅ [FASE 2] UPDATE com SLA recalculado: X min"

// FASE 3: Timer Manager
"⏱️ Registrando instância adicional do ticket X (refCount: 2)"
"⏱️ Desregistrando instância do ticket X (refCount: 1)"
```

---

## ✅ Checklist de Validação

- [ ] Timer decrementa normalmente quando SLA ativo
- [ ] Timer para quando qualquer flag de pausa é ativada
- [ ] Tempo pausado acumula corretamente no banco
- [ ] Fórmula de cálculo bate (verificar painel de debug)
- [ ] Realtime atualiza todas as abas abertas
- [ ] Resincronização a cada 10s funciona
- [ ] Painel de debug mostra valores corretos
- [ ] SLA não vence quando pausado
- [ ] Múltiplas pausas acumulam corretamente

---

## 🚀 Próximos Passos (Futuro)

- [ ] Dashboard de métricas de SLA (% no prazo, tempo médio pausado)
- [ ] Alertas proativos (SLA < 25% restante)
- [ ] Histórico de pausas (auditoria)
- [ ] Análise de padrões (tickets que mais pausam)

---

## 📝 Notas Importantes

1. **Sempre use a view** `tickets_with_realtime_sla` para consultas
2. **Nunca calcule SLA no frontend** - use o valor do backend
3. **Trigger é automático** - não precisa chamar manualmente
4. **Resincronização é essencial** - garante consistência
5. **Painel de debug** só aparece em desenvolvimento

---

## 📚 Referências

- Documentação completa: `src/lib/sla-flags-documentation.ts`
- Migration Fase 1: `supabase/migrations/*_fase1.sql`
- Exemplos de uso: `src/components/tickets/SLADebugPanel.tsx`
