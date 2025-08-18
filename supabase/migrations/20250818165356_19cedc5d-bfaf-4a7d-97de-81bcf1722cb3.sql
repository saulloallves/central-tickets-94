
-- 1) TABELAS DE CONFIG E SUPORTE

-- Configurações gerais de notificação (dados não sensíveis)
create table if not exists public.notification_settings (
  id uuid primary key default gen_random_uuid(),
  numero_remetente text,                  -- número padrão do WhatsApp
  webhook_entrada text,
  webhook_saida text,
  delay_mensagem integer not null default 2000,
  limite_retentativas integer not null default 3,
  modelo_mensagem_sla text,               -- id/template
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notification_settings enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notification_settings'
  ) then
    -- Admins gerenciam tudo
    create policy "Admins manage notification_settings"
      on public.notification_settings
      for all
      using (has_role(auth.uid(), 'admin'::app_role))
      with check (has_role(auth.uid(), 'admin'::app_role));
    -- (Opcional) Gerentes podem ver
    create policy "Gerentes view notification_settings"
      on public.notification_settings
      for select
      using (has_role(auth.uid(), 'gerente'::app_role));
  end if;
end $$;

-- Mapeamento de escalonamento hierárquico
-- Pode ser global (unidade_id nulo) ou específico por unidade
create table if not exists public.escalation_levels (
  id uuid primary key default gen_random_uuid(),
  unidade_id text null,
  ordem integer not null,                      -- nível 1..N
  role public.app_role null,                   -- 'colaborador' | 'gerente' | 'diretor' | ...
  destino_user_id uuid null,                   -- opcional: usuário específico
  destino_whatsapp text null,                  -- opcional: número/ID de grupo
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.escalation_levels enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'escalation_levels'
  ) then
    create policy "Admins manage escalation_levels"
      on public.escalation_levels
      for all
      using (has_role(auth.uid(), 'admin'::app_role))
      with check (has_role(auth.uid(), 'admin'::app_role));

    create policy "Gerentes view escalation_levels"
      on public.escalation_levels
      for select
      using (has_role(auth.uid(), 'gerente'::app_role));
  end if;
end $$;

-- Logs de escalonamento (auditoria)
create table if not exists public.escalation_logs (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  from_level integer null,
  to_level integer null,
  to_user_id uuid null,
  canal text not null default 'zapi',            -- zapi | email | painel
  event_type text not null,                      -- created | sla_half | sla_breach | crisis | no_response
  message text null,
  response jsonb null,
  created_at timestamptz not null default now()
);

alter table public.escalation_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'escalation_logs'
  ) then
    create policy "Admins manage escalation_logs"
      on public.escalation_logs
      for all
      using (has_role(auth.uid(), 'admin'::app_role))
      with check (has_role(auth.uid(), 'admin'::app_role));

    create policy "Gerentes view escalation_logs"
      on public.escalation_logs
      for select
      using (has_role(auth.uid(), 'gerente'::app_role));
  end if;
end $$;

-- Fila de notificações a processar por Edge Function
create table if not exists public.notifications_queue (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  type text not null,                               -- ticket_created | sla_half | sla_breach | escalation | crisis
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending',           -- pending | sent | failed
  attempts int not null default 0,
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz null,
  created_at timestamptz not null default now()
);

alter table public.notifications_queue enable row level security;

-- Admin vê/gerencia
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'notifications_queue'
  ) then
    create policy "Admins manage notifications_queue"
      on public.notifications_queue
      for all
      using (has_role(auth.uid(), 'admin'::app_role))
      with check (has_role(auth.uid(), 'admin'::app_role));
  end if;
end $$;

-- Garantir unicidade para eventos únicos por ticket
create unique index if not exists uq_notifications_ticket_type_single
  on public.notifications_queue (ticket_id, type)
  where type in ('ticket_created', 'sla_half', 'sla_breach', 'crisis');

create index if not exists idx_notifications_queue_status_sched
  on public.notifications_queue (status, scheduled_at);


-- 2) AJUSTES NA TABELA DE TICKETS (SLA + ESCALONAMENTO)

-- Campos auxiliares para SLA e escalonamento
alter table public.tickets
  add column if not exists sla_half_time timestamptz,
  add column if not exists escalonamento_nivel integer not null default 0;

-- Opcional: se quiser marcar crise única (usaremos fila c/ unique index)
-- alter table public.tickets add column if not exists crise_notificada boolean not null default false;


-- 3) FUNÇÕES AUXILIARES DE SLA

-- Adiciona 24h ignorando finais de semana (aproximação)
create or replace function public.add_24h_skip_weekend(ts timestamptz)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  start_ts timestamptz := ts;
  end_ts timestamptz;
  dow_start int;
  dow_end int;
begin
  -- Se abriu no fim de semana, começa na segunda no mesmo horário
  dow_start := extract(dow from start_ts);
  if dow_start = 6 then
    -- sábado -> +2 dias
    start_ts := start_ts + interval '2 day';
  elsif dow_start = 0 then
    -- domingo -> +1 dia
    start_ts := start_ts + interval '1 day';
  end if;

  end_ts := start_ts + interval '24 hour';

  dow_end := extract(dow from end_ts);
  if dow_end = 6 then
    end_ts := end_ts + interval '2 day';
  elsif dow_end = 0 then
    end_ts := end_ts + interval '1 day';
  end if;

  return end_ts;
end;
$$;

-- 4) ATUALIZAR REGRAS DOS TRIGGERS DE TICKETS PARA NOVOS SLAs

create or replace function public.tickets_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Gerar código se não tiver
  if new.codigo_ticket is null or new.codigo_ticket = '' then
    new.codigo_ticket := next_ticket_code(new.unidade_id);
  end if;

  -- Set default data_abertura
  if new.data_abertura is null then
    new.data_abertura := now();
  end if;

  -- Definir data_limite_sla conforme prioridade
  if new.data_limite_sla is null then
    case new.prioridade
      when 'urgente' then new.data_limite_sla := new.data_abertura + interval '10 minutes';
      when 'alta' then new.data_limite_sla := new.data_abertura + interval '1 hour';
      when 'hoje_18h' then
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

create or replace function public.tickets_before_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  new.updated_at := now();

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
      when 'urgente' then new.data_limite_sla := new.data_abertura + interval '10 minutes';
      when 'alta' then new.data_limite_sla := new.data_abertura + interval '1 hour';
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

-- Criar triggers (se ainda não existem)
drop trigger if exists trg_tickets_before_insert on public.tickets;
create trigger trg_tickets_before_insert
before insert on public.tickets
for each row execute function public.tickets_before_insert();

drop trigger if exists trg_tickets_before_update on public.tickets;
create trigger trg_tickets_before_update
before update on public.tickets
for each row execute function public.tickets_before_update();


-- 5) GATILHOS PARA ENFILEIRAR EVENTOS (50%, 100%, CRISE, NOVO TICKET)

create or replace function public.tickets_after_insert_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Sempre: novo ticket
  insert into public.notifications_queue (ticket_id, type, payload)
  values (new.id, 'ticket_created', jsonb_build_object(
    'unidade_id', new.unidade_id,
    'prioridade', new.prioridade,
    'categoria', new.categoria,
    'codigo_ticket', new.codigo_ticket
  ))
  on conflict (ticket_id, type)
  where type in ('ticket_created')
  do nothing;

  -- Se já veio como crise
  if new.prioridade = 'crise' then
    insert into public.notifications_queue (ticket_id, type, payload)
    values (new.id, 'crisis', jsonb_build_object(
      'unidade_id', new.unidade_id,
      'codigo_ticket', new.codigo_ticket
    ))
    on conflict (ticket_id, type)
    where type in ('crisis')
    do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_after_insert_notify on public.tickets;
create trigger trg_tickets_after_insert_notify
after insert on public.tickets
for each row execute function public.tickets_after_insert_notify();


create or replace function public.tickets_after_update_notify()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
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

  -- Se virar crise em alguma atualização
  if new.prioridade = 'crise' and coalesce(old.prioridade, '') <> 'crise' then
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
$$;

drop trigger if exists trg_tickets_after_update_notify on public.tickets;
create trigger trg_tickets_after_update_notify
after update on public.tickets
for each row execute function public.tickets_after_update_notify();


-- 6) PERMISSÃO PARA CRIADOR ATUALIZAR CAMPOS BÁSICOS (IA via token do usuário)
-- Permite ao criador atualizar seu próprio ticket (IA vai atualizar prioridade/categoria/… pelo mesmo usuário sem precisar service-role)
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='tickets' and policyname='Creators can update their own tickets (basic)'
  ) then
    create policy "Creators can update their own tickets (basic)"
      on public.tickets
      for update
      using (auth.uid() = criado_por)
      with check (auth.uid() = criado_por);
  end if;
end $$;
