-- Fix the tickets_after_update_notify trigger function to handle enum comparisons properly
CREATE OR REPLACE FUNCTION public.tickets_after_update_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  half_reached boolean := false;
begin
  -- 50% do SLA
  if new.sla_half_time is not null and now() >= new.sla_half_time then
    half_reached := true;
  end if;

  if half_reached then
    insert into public.notifications_queue (ticket_id, type, payload)
    select new.id, 'sla_half', jsonb_build_object(
      'unidade_id', new.unidade_id,
      'codigo_ticket', new.codigo_ticket
    )
    where not exists (
      select 1 from public.notifications_queue q
      where q.ticket_id = new.id and q.type = 'sla_half'
    );
  end if;

  -- 100% vencido
  if new.status_sla = 'vencido' then
    insert into public.notifications_queue (ticket_id, type, payload)
    select new.id, 'sla_breach', jsonb_build_object(
      'unidade_id', new.unidade_id,
      'codigo_ticket', new.codigo_ticket
    )
    where not exists (
      select 1 from public.notifications_queue q
      where q.ticket_id = new.id and q.type = 'sla_breach'
    );
  end if;

  -- Se virar crise em alguma atualização (fixed enum comparison)
  if new.prioridade = 'crise' AND (OLD.prioridade IS DISTINCT FROM 'crise'::ticket_prioridade) then
    insert into public.notifications_queue (ticket_id, type, payload)
    select new.id, 'crisis', jsonb_build_object(
      'unidade_id', new.unidade_id,
      'codigo_ticket', new.codigo_ticket
    )
    where not exists (
      select 1 from public.notifications_queue q
      where q.ticket_id = new.id and q.type = 'crisis'
    );
  end if;

  return new;
end;
$function$