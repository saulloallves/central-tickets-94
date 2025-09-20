-- Corrigir mapeamento de prioridades no trigger
CREATE OR REPLACE FUNCTION public.tickets_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sla_minutes INTEGER;
  advanced_settings RECORD;
  priority_key TEXT;
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
    
    -- Mapear prioridades do ticket para chaves do priority_matrix
    priority_key := CASE new.prioridade
      WHEN 'posso_esperar' THEN 'baixo'
      WHEN 'ate_1_hora' THEN 'medio'
      WHEN 'ainda_hoje' THEN 'alto'
      WHEN 'imediato' THEN 'critico'
      WHEN 'crise' THEN 'critico'
      WHEN 'urgente' THEN 'critico'
      WHEN 'alta' THEN 'alto'
      ELSE 'baixo'  -- fallback para baixo
    END;
    
    -- Se encontrou configurações e existe a prioridade mapeada na matriz
    IF advanced_settings IS NOT NULL AND 
       advanced_settings.priority_matrix ? priority_key THEN
      
      -- Extrai os minutos do SLA da configuração usando a chave mapeada
      sla_minutes := (advanced_settings.priority_matrix -> priority_key ->> 'sla_minutes')::INTEGER;
      
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