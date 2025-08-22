-- Corrigir função tickets_before_update para suportar apenas as novas prioridades
CREATE OR REPLACE FUNCTION public.tickets_before_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  -- Garantir que apenas prioridades válidas sejam aceitas
  IF NEW.prioridade NOT IN ('imediato', 'ate_1_hora', 'ainda_hoje', 'posso_esperar', 'crise') THEN
    -- Mapear prioridades antigas para novas
    CASE NEW.prioridade::text
      WHEN 'urgente' THEN NEW.prioridade := 'imediato'::ticket_prioridade;
      WHEN 'alta' THEN NEW.prioridade := 'ate_1_hora'::ticket_prioridade;
      WHEN 'hoje_18h' THEN NEW.prioridade := 'ainda_hoje'::ticket_prioridade;
      WHEN 'padrao_24h' THEN NEW.prioridade := 'posso_esperar'::ticket_prioridade;
      ELSE NEW.prioridade := 'posso_esperar'::ticket_prioridade;
    END CASE;
  END IF;

  -- Recalcular SLA quando prioridade muda
  if NEW.prioridade IS DISTINCT FROM OLD.prioridade then
    case NEW.prioridade
      when 'imediato' then NEW.data_limite_sla := NEW.data_abertura + interval '15 minutes';
      when 'ate_1_hora' then NEW.data_limite_sla := NEW.data_abertura + interval '1 hour';
      when 'ainda_hoje' then
        NEW.data_limite_sla := date_trunc('day', NEW.data_abertura) + interval '18 hours';
        if NEW.data_limite_sla <= NEW.data_abertura then
          NEW.data_limite_sla := NEW.data_limite_sla + interval '1 day';
        end if;
        if extract(dow from NEW.data_limite_sla) = 6 then
          NEW.data_limite_sla := date_trunc('day', NEW.data_limite_sla) + interval '2 day' + interval '18 hour';
        elsif extract(dow from NEW.data_limite_sla) = 0 then
          NEW.data_limite_sla := date_trunc('day', NEW.data_limite_sla) + interval '1 day' + interval '18 hour';
        end if;
      when 'posso_esperar' then
        NEW.data_limite_sla := add_24h_skip_weekend(NEW.data_abertura);
      when 'crise' then NEW.data_limite_sla := NEW.data_abertura + interval '5 minutes';
    end case;

    NEW.sla_half_time := NEW.data_abertura + ((NEW.data_limite_sla - NEW.data_abertura) / 2);
  end if;

  -- Calcular status SLA
  if now() >= NEW.data_limite_sla then
    NEW.status_sla := 'vencido';
  elsif now() >= (NEW.data_limite_sla - interval '2 hours') then
    NEW.status_sla := 'alerta';
  else
    NEW.status_sla := 'dentro_prazo';
  end if;

  return NEW;
end;
$function$;