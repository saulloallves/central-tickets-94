
-- 1) Tabela de rotas de notificação
create table if not exists public.notification_routes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,

  -- Se null => rota global; se preenchido => rota aplicada à unidade
  unit_id text null,

  -- Tipo de evento (ex.: 'crisis', 'crisis_resolved', 'sla_half', 'sla_breach', 'ticket_criado', etc.)
  type text not null,

  -- Telefone/ID do grupo de destino (Z-API)
  destination_value text not null,

  -- Campos auxiliares
  destination_label text null,
  description text null,
  priority int not null default 0
);

-- Índices para performance de busca
create index if not exists idx_notification_routes_type on public.notification_routes (type);
create index if not exists idx_notification_routes_unit_type on public.notification_routes (unit_id, type);
create index if not exists idx_notification_routes_active on public.notification_routes (is_active);

-- RLS
alter table public.notification_routes enable row level security;

-- Políticas
drop policy if exists "Admins manage notification_routes" on public.notification_routes;
create policy "Admins manage notification_routes"
  on public.notification_routes
  for all
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

drop policy if exists "Gerentes view notification_routes" on public.notification_routes;
create policy "Gerentes view notification_routes"
  on public.notification_routes
  for select
  using (has_role(auth.uid(), 'gerente'::app_role));

-- Trigger para updated_at
drop trigger if exists set_timestamp on public.notification_routes;
create trigger set_timestamp
  before update on public.notification_routes
  for each row
  execute function public.update_updated_at_column();

-- 2) Atualizar função de resolver crise para gerar notificação "crisis_resolved"
create or replace function public.resolve_crisis(p_crisis_id uuid, p_resolvida_por uuid default null)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ticket_id uuid;
begin
  update public.crises_ativas
     set resolvida_em = now(),
         resolvida_por = p_resolvida_por,
         log_acoes = log_acoes || jsonb_build_object('acao','resolver','por',p_resolvida_por,'em',now())
   where id = p_crisis_id;

  -- Descobrir ticket vinculado à crise
  select ticket_id into v_ticket_id
    from public.crises_ativas
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

  -- Enfileirar notificação de crise resolvida (se tivermos o ticket)
  if v_ticket_id is not null then
    insert into public.notifications_queue (ticket_id, type, alert_level, payload)
    values (v_ticket_id, 'crisis_resolved', 'critical', jsonb_build_object('crisis_id', p_crisis_id));
  end if;
end;
$function$;

-- 3) Atualizar função de log de ações da crise para gerar notificação "crisis_update"
create or replace function public.log_crisis_action(p_crisis_id uuid, p_acao text, p_by uuid default null, p_meta jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_ticket_id uuid;
begin
  update public.crises_ativas
     set log_acoes = log_acoes || jsonb_build_object('acao', p_acao, 'por', p_by, 'meta', p_meta, 'em', now())
   where id = p_crisis_id;

  -- Tentar descobrir ticket para enfileirar notificação de atualização
  select ticket_id into v_ticket_id
    from public.crises_ativas
   where id = p_crisis_id;

  if v_ticket_id is not null then
    insert into public.notifications_queue (ticket_id, type, alert_level, payload)
    values (
      v_ticket_id,
      'crisis_update',
      'critical',
      jsonb_build_object('crisis_id', p_crisis_id, 'acao', p_acao, 'meta', coalesce(p_meta, '{}'::jsonb))
    );
  end if;
end;
$function$;
