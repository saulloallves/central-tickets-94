-- Atualizar priority_matrix para usar nomes corretos das prioridades
UPDATE public.ai_classifier_advanced_settings 
SET priority_matrix = '{
  "posso_esperar": {"impact": "baixo", "urgency": "baixa", "sla_minutes": 1440},
  "ate_1_hora": {"impact": "medio", "urgency": "media", "sla_minutes": 60},
  "ainda_hoje": {"impact": "alto", "urgency": "media", "sla_minutes": 1080},
  "imediato": {"impact": "alto", "urgency": "alta", "sla_minutes": 30},
  "crise": {"impact": "critico", "urgency": "critica", "sla_minutes": 5}
}'::jsonb
WHERE ativo = true;

-- Atualizar emergency_keywords para usar as prioridades corretas
UPDATE public.ai_classifier_advanced_settings 
SET emergency_keywords = '{
  "posso_esperar": ["duvida", "orientacao", "informacao", "sugestao"],
  "ate_1_hora": ["problema", "dificuldade", "demora", "instavel"],
  "ainda_hoje": ["lento", "travando", "erro", "nao funciona", "urgente"],
  "imediato": ["erro critico", "sistema lento", "falha grave", "problema serio"],
  "crise": ["sistema caiu", "fora do ar", "parou completamente", "emergencia", "critico"]
}'::jsonb
WHERE ativo = true;

-- Simplificar o trigger para usar diretamente as prioridades
CREATE OR REPLACE FUNCTION public.tickets_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sla_minutes INTEGER;
  advanced_settings RECORD;
BEGIN
  new.updated_at := now();

  -- Gerar código do ticket se não fornecido
  if new.codigo_ticket is null then
    new.codigo_ticket := public.next_ticket_code(new.unidade_id);
  end if;

  -- Auto-assign franqueado_id if missing
  if new.franqueado_id is null then
    select f.id into new.franqueado_id
    from public.franqueados f
    where f.unit_code ? new.unidade_id;
  end if;

  -- Definir data_limite_sla consultando AI Classifier Advanced Settings
  if new.data_limite_sla is null then
    -- Primeiro tenta buscar configurações do AI Classifier Avançado
    SELECT * INTO advanced_settings 
    FROM public.ai_classifier_advanced_settings 
    WHERE ativo = true 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Se encontrou configurações e existe a prioridade na matriz
    IF advanced_settings IS NOT NULL AND 
       advanced_settings.priority_matrix ? new.prioridade THEN
      
      -- Extrai os minutos do SLA da configuração usando a prioridade diretamente
      sla_minutes := (advanced_settings.priority_matrix -> new.prioridade ->> 'sla_minutes')::INTEGER;
      
      -- Aplica o SLA configurado
      IF sla_minutes > 0 THEN
        new.data_limite_sla := new.data_abertura + (sla_minutes || ' minutes')::INTERVAL;
      ELSE
        -- Fallback para regras padrão se sla_minutes for 0 ou inválido
        new.data_limite_sla := new.data_abertura + interval '24 hours';
      END IF;
      
    ELSE
      -- Fallback para regras hardcoded caso não encontre configurações
      case new.prioridade
        when 'imediato' then new.data_limite_sla := new.data_abertura + interval '30 minutes';
        when 'ate_1_hora' then new.data_limite_sla := new.data_abertura + interval '1 hour';
        when 'ainda_hoje' then
          -- hoje às 18h (se já passou, próximo dia útil às 18h)
          new.data_limite_sla := date_trunc('day', new.data_abertura) + interval '18 hours';
          if new.data_limite_sla <= new.data_abertura then
            -- próximo dia
            new.data_limite_sla := new.data_limite_sla + interval '1 day';
          end if;
          -- se cair no fim de semana, joga para segunda 18h
          if extract(dow from new.data_limite_sla) = 6 then
            new.data_limite_sla := date_trunc('day', new.data_limite_sla) + interval '2 day' + interval '18 hour';
          elsif extract(dow from new.data_limite_sla) = 0 then
            new.data_limite_sla := date_trunc('day', new.data_limite_sla) + interval '1 day' + interval '18 hour';
          end if;
        when 'posso_esperar' then new.data_limite_sla := new.data_abertura + interval '24 hours';
        when 'urgente' then new.data_limite_sla := new.data_abertura + interval '10 minutes';
        when 'alta' then new.data_limite_sla := new.data_abertura + interval '1 hour';
        when 'crise' then new.data_limite_sla := new.data_abertura + interval '5 minutes';
        else
          new.data_limite_sla := new.data_abertura + interval '24 hours';
      end case;
    END IF;
  end if;

  -- Calcular status SLA
  if now() >= new.data_limite_sla then
    new.status_sla := 'vencido';
  elsif now() >= (new.data_limite_sla - interval '2 hours') then
    new.status_sla := 'alerta';
  else
    new.status_sla := 'dentro_prazo';
  end if;

  -- Meio do prazo para notificação de 50%
  new.sla_half_time := new.data_abertura + ((new.data_limite_sla - new.data_abertura) / 2);

  return new;
end;
$function$;