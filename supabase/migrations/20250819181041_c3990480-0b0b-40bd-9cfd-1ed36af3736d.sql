
-- 1) Tabela principal das crises
create table if not exists public.crises_ativas (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  motivo text,
  criada_por uuid,
  criada_em timestamptz not null default now(),
  resolvida_em timestamptz,
  resolvida_por uuid,
  log_acoes jsonb not null default '[]'::jsonb,
  impacto_regional text[],
  comunicado_emitido boolean not null default false
);

alter table public.crises_ativas enable row level security;

-- Índices úteis
create index if not exists crises_ativas_ticket_id_idx on public.crises_ativas(ticket_id);
create index if not exists crises_ativas_criada_em_idx on public.crises_ativas(criada_em);
create index if not exists crises_ativas_ativas_idx on public.crises_ativas((resolvida_em is null));

-- RLS Policies
drop policy if exists "Admins manage crises_ativas" on public.crises_ativas;
create policy "Admins manage crises_ativas"
  on public.crises_ativas
  for all
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Diretoria view crises_ativas" on public.crises_ativas;
create policy "Diretoria view crises_ativas"
  on public.crises_ativas
  for select
  using (has_role(auth.uid(), 'diretoria'::app_role));

drop policy if exists "Gerentes view crises_ativas for manageable tickets" on public.crises_ativas;
create policy "Gerentes view crises_ativas for manageable tickets"
  on public.crises_ativas
  for select
  using (
    exists (
      select 1
      from public.tickets t
      where t.id = crises_ativas.ticket_id
        and can_update_ticket(t.unidade_id)
    )
  );

drop policy if exists "Users view crises_ativas for accessible tickets" on public.crises_ativas;
create policy "Users view crises_ativas for accessible tickets"
  on public.crises_ativas
  for select
  using (
    exists (
      select 1
      from public.tickets t
      where t.id = crises_ativas.ticket_id
        and can_view_ticket(t.unidade_id)
    )
  );

-- 2) Função para ativar crise
create or replace function public.activate_crisis(
  p_ticket_id uuid,
  p_motivo text default null,
  p_criada_por uuid default null,
  p_impacto_regional text[] default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_crisis_id uuid;
  v_ticket public.tickets%rowtype;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id;
  if not found then
    raise exception 'Ticket % not found', p_ticket_id;
  end if;

  insert into public.crises_ativas (ticket_id, motivo, criada_por, impacto_regional)
  values (p_ticket_id, coalesce(p_motivo, 'Ativação de crise'), p_criada_por, p_impacto_regional)
  returning id into v_crisis_id;

  -- Escalonar ticket para CRISE
  update public.tickets
     set prioridade = 'crise'::ticket_prioridade,
         status = 'escalonado'::ticket_status,
         escalonamento_nivel = greatest(coalesce(escalonamento_nivel,0), 5)
   where id = p_ticket_id;

  -- Notificação de crise
  insert into public.notifications_queue (ticket_id, type, payload)
  values (p_ticket_id, 'crisis', jsonb_build_object('unidade_id', v_ticket.unidade_id, 'codigo_ticket', v_ticket.codigo_ticket))
  on conflict (ticket_id, type) where type in ('crisis') do nothing;

  -- Log sistêmico
  perform public.log_system_action(
    'sistema'::public.log_tipo,
    'crises_ativas',
    v_crisis_id::text,
    'Crise ativada',
    p_criada_por,
    null, null, null,
    null,
    jsonb_build_object('ticket_id', p_ticket_id, 'motivo', p_motivo),
    'painel_interno'::public.log_canal
  );

  -- Primeira ação no histórico
  update public.crises_ativas
     set log_acoes = log_acoes || jsonb_build_object(
       'acao', 'ativar',
       'por', p_criada_por,
       'em', now(),
       'motivo', p_motivo
     )
   where id = v_crisis_id;

  return v_crisis_id;
end;
$$;

-- 3) Função para encerrar crise
create or replace function public.resolve_crisis(
  p_crisis_id uuid,
  p_resolvida_por uuid default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crises_ativas
     set resolvida_em = now(),
         resolvida_por = p_resolvida_por,
         log_acoes = log_acoes || jsonb_build_object('acao','resolver','por',p_resolvida_por,'em',now())
   where id = p_crisis_id;

  perform public.log_system_action(
    'sistema'::public.log_tipo,
    'crises_ativas',
    p_crisis_id::text,
    'Crise resolvida',
    p_resolvida_por,
    null, null, null, null, null,
    'painel_interno'::public.log_canal
  );
end;
$$;

-- 4) Função para registrar ações no histórico
create or replace function public.log_crisis_action(
  p_crisis_id uuid,
  p_acao text,
  p_by uuid default null,
  p_meta jsonb default '{}'::jsonb
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.crises_ativas
     set log_acoes = log_acoes || jsonb_build_object('acao', p_acao, 'por', p_by, 'meta', p_meta, 'em', now())
   where id = p_crisis_id;
end;
$$;

-- 5) Detecção automática (gatilho após criar ticket)
create or replace function public.check_and_activate_crisis()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_keywords text[] := array[
    'travou tudo','não consigo vender','nao consigo vender','cliente xingando',
    'reclamação grave','reclamacao grave','ação judicial','acao judicial',
    'urgência máxima','urgencia maxima','ameaça','advogado','procon','trava total'
  ];
  v_matches boolean := false;
  v_count int := 0;
  v_motivo text;
begin
  -- Palavras-chave críticas
  if new.descricao_problema is not null then
    for i in array_lower(v_keywords,1)..array_upper(v_keywords,1) loop
      if new.descricao_problema ilike '%' || v_keywords[i] || '%' then
        v_matches := true;
        exit;
      end if;
    end loop;
  end if;

  -- Fallback por categoria (mesma categoria em volume)
  if not v_matches and new.categoria is not null then
    select count(*) into v_count
      from public.tickets t
     where t.data_abertura >= now() - interval '10 minutes'
       and t.categoria = new.categoria
       and t.status <> 'concluido';
    if v_count >= 3 then
      v_matches := true;
    end if;
  end if;

  -- Contagem consolidada 10min (keywords OU mesma categoria)
  if v_matches then
    select count(*) into v_count
      from public.tickets t
     where t.data_abertura >= now() - interval '10 minutes'
       and (
         t.descricao_problema ilike any (select '%'||k||'%' from unnest(v_keywords) k)
         or (new.categoria is not null and t.categoria = new.categoria)
       )
       and t.status <> 'concluido';

    if v_count >= 3 then
      -- Evitar duplicidade: já existe crise ativa similar?
      if not exists (
        select 1
          from public.crises_ativas ca
          join public.tickets tk on tk.id = ca.ticket_id
         where ca.resolvida_em is null
           and tk.data_abertura >= now() - interval '60 minutes'
           and (
             (new.categoria is not null and tk.categoria = new.categoria)
             or (new.descricao_problema ilike any (select '%'||k||'%' from unnest(v_keywords) k))
           )
      ) then
        v_motivo := coalesce(
          'Ativação automática por detecção: ' ||
          case when new.categoria is not null then 'categoria '||new.categoria::text else 'palavras-chave' end,
          'Ativação automática'
        );
        perform public.activate_crisis(new.id, v_motivo, auth.uid(), array[new.unidade_id]);
      end if;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_tickets_after_insert_check_crisis on public.tickets;
create trigger trg_tickets_after_insert_check_crisis
after insert on public.tickets
for each row
execute function public.check_and_activate_crisis();
