-- Add new priority enum values
ALTER TYPE ticket_prioridade ADD VALUE IF NOT EXISTS 'imediato';
ALTER TYPE ticket_prioridade ADD VALUE IF NOT EXISTS 'ate_1_hora';
ALTER TYPE ticket_prioridade ADD VALUE IF NOT EXISTS 'ainda_hoje';
ALTER TYPE ticket_prioridade ADD VALUE IF NOT EXISTS 'posso_esperar';

-- Update the tickets_before_insert function to handle new priorities
CREATE OR REPLACE FUNCTION public.tickets_before_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  -- Gerar código se não tiver
  if new.codigo_ticket is null or new.codigo_ticket = '' then
    new.codigo_ticket := next_ticket_code(new.unidade_id);
  end if;

  -- Set default data_abertura
  if new.data_abertura is null then
    new.data_abertura := now();
  end if;

  -- Auto-assign franqueado_id based on unidade_id
  if new.franqueado_id is null then
    select f.id into new.franqueado_id
    from public.franqueados f
    where f.unit_code ? new.unidade_id;
  end if;

  -- Definir data_limite_sla conforme prioridade
  if new.data_limite_sla is null then
    case new.prioridade
      when 'imediato' then new.data_limite_sla := new.data_abertura + interval '15 minutes';
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
      when 'posso_esperar' then
        -- 24 horas úteis (aproximação ignorando fds)
        new.data_limite_sla := add_24h_skip_weekend(new.data_abertura);
      when 'urgente' then new.data_limite_sla := new.data_abertura + interval '15 minutes'; -- Legacy support
      when 'alta' then new.data_limite_sla := new.data_abertura + interval '1 hour'; -- Legacy support
      when 'hoje_18h' then
        -- Legacy support
        new.data_limite_sla := date_trunc('day', new.data_abertura) + interval '18 hours';
        if new.data_limite_sla <= new.data_abertura then
          new.data_limite_sla := new.data_limite_sla + interval '1 day';
        end if;
        if extract(dow from new.data_limite_sla) = 6 then
          new.data_limite_sla := date_trunc('day', new.data_limite_sla) + interval '2 day' + interval '18 hour';
        elsif extract(dow from new.data_limite_sla) = 0 then
          new.data_limite_sla := date_trunc('day', new.data_limite_sla) + interval '1 day' + interval '18 hour';
        end if;
      when 'crise' then new.data_limite_sla := new.data_abertura + interval '5 minutes';
      else
        -- padrao_24h: 24 horas úteis (aproximação ignorando fds)
        new.data_limite_sla := add_24h_skip_weekend(new.data_abertura);
    end case;
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

-- Update the tickets_before_update function to handle new priorities
CREATE OR REPLACE FUNCTION public.tickets_before_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  new.updated_at := now();

  -- Auto-assign franqueado_id if missing
  if new.franqueado_id is null then
    select f.id into new.franqueado_id
    from public.franqueados f
    where f.unit_code ? new.unidade_id;
  end if;

  -- timestamp de resolução ao concluir
  if new.status = 'concluido' and old.status != 'concluido' then
    new.resolvido_em := now();
  end if;

  -- reabertura
  if old.status = 'concluido' and new.status != 'concluido' then
    new.reaberto_count := old.reaberto_count + 1;
    new.resolvido_em := null;
  end if;

  -- se prioridade mudou, recalcular SLA conforme regra
  if new.prioridade is distinct from old.prioridade then
    case new.prioridade
      when 'imediato' then new.data_limite_sla := new.data_abertura + interval '15 minutes';
      when 'ate_1_hora' then new.data_limite_sla := new.data_abertura + interval '1 hour';
      when 'ainda_hoje' then
        new.data_limite_sla := date_trunc('day', new.data_abertura) + interval '18 hours';
        if new.data_limite_sla <= new.data_abertura then
          new.data_limite_sla := new.data_limite_sla + interval '1 day';
        end if;
        if extract(dow from new.data_limite_sla) = 6 then
          new.data_limite_sla := date_trunc('day', new.data_limite_sla) + interval '2 day' + interval '18 hour';
        elsif extract(dow from new.data_limite_sla) = 0 then
          new.data_limite_sla := date_trunc('day', new.data_limite_sla) + interval '1 day' + interval '18 hour';
        end if;
      when 'posso_esperar' then
        new.data_limite_sla := add_24h_skip_weekend(new.data_abertura);
      when 'urgente' then new.data_limite_sla := new.data_abertura + interval '15 minutes'; -- Legacy
      when 'alta' then new.data_limite_sla := new.data_abertura + interval '1 hour'; -- Legacy
      when 'hoje_18h' then
        new.data_limite_sla := date_trunc('day', new.data_abertura) + interval '18 hours';
        if new.data_limite_sla <= new.data_abertura then
          new.data_limite_sla := new.data_limite_sla + interval '1 day';
        end if;
        if extract(dow from new.data_limite_sla) = 6 then
          new.data_limite_sla := date_trunc('day', new.data_limite_sla) + interval '2 day' + interval '18 hour';
        elsif extract(dow from new.data_limite_sla) = 0 then
          new.data_limite_sla := date_trunc('day', new.data_limite_sla) + interval '1 day' + interval '18 hour';
        end if;
      when 'crise' then new.data_limite_sla := new.data_abertura + interval '5 minutes';
      else
        new.data_limite_sla := add_24h_skip_weekend(new.data_abertura);
    end case;
    new.sla_half_time := new.data_abertura + ((new.data_limite_sla - new.data_abertura) / 2);
  end if;

  -- Recalcula status SLA
  if now() >= new.data_limite_sla then
    new.status_sla := 'vencido';
  elsif now() >= (new.data_limite_sla - interval '2 hours') then
    new.status_sla := 'alerta';
  else
    new.status_sla := 'dentro_prazo';
  end if;

  return new;
end;
$function$;