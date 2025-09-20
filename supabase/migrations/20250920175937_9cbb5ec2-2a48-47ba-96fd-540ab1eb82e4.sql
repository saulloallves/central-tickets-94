-- Atualizar configurações do AI classifier com nova matriz de prioridades
UPDATE public.ai_classifier_advanced_settings 
SET priority_matrix = jsonb_build_object(
  'baixo', jsonb_build_object('impact', 'baixo', 'urgency', 'baixa', 'sla_minutes', 1440),
  'medio', jsonb_build_object('impact', 'medio', 'urgency', 'media', 'sla_minutes', 600), 
  'alto', jsonb_build_object('impact', 'alto', 'urgency', 'media', 'sla_minutes', 60),
  'imediato', jsonb_build_object('impact', 'alto', 'urgency', 'alta', 'sla_minutes', 15),
  'crise', jsonb_build_object('impact', 'critico', 'urgency', 'critica', 'sla_minutes', 5)
),
emergency_keywords = jsonb_build_object(
  'baixo', jsonb_build_array('duvida', 'orientacao', 'informacao', 'sugestao'),
  'medio', jsonb_build_array('problema', 'dificuldade', 'demora', 'instavel'),
  'alto', jsonb_build_array('lento', 'travando', 'erro critico', 'nao funciona', 'urgente'),
  'imediato', jsonb_build_array('sistema muito lento', 'erro grave', 'funcionalidade quebrada'),
  'crise', jsonb_build_array('sistema caiu', 'fora do ar', 'parou completamente', 'emergencia', 'critico')
)
WHERE ativo = true;

-- Recriar função de trigger com novas prioridades
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
       advanced_settings.priority_matrix ? new.prioridade::text THEN
      
      -- Extrai os minutos do SLA da configuração
      sla_minutes := (advanced_settings.priority_matrix -> new.prioridade::text ->> 'sla_minutes')::INTEGER;
      
      -- Aplica o SLA configurado
      IF sla_minutes > 0 THEN
        new.data_limite_sla := new.data_abertura + (sla_minutes || ' minutes')::INTERVAL;
      ELSE
        new.data_limite_sla := new.data_abertura + interval '24 hours';
      END IF;
      
    ELSE
      -- Fallback para regras hardcoded
      case new.prioridade
        when 'imediato' then new.data_limite_sla := new.data_abertura + interval '15 minutes';
        when 'alto' then new.data_limite_sla := new.data_abertura + interval '1 hour';
        when 'medio' then new.data_limite_sla := new.data_abertura + interval '10 hours';
        when 'baixo' then new.data_limite_sla := new.data_abertura + interval '24 hours';
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