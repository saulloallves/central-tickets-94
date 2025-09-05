
-- 1) Tabela única para conversas de WhatsApp
create table if not exists public.whatsapp_conversas (
  id                uuid primary key default gen_random_uuid(),
  -- Identificadores da instância/conexão e do contato
  instance_id       text        not null,
  connected_phone   text        not null,
  contact_phone     text        not null,
  contact_name      text,
  sender_lid        text,
  sender_photo      text,
  is_group          boolean     not null default false,

  -- Conversa como JSONB (array de mensagens)
  -- Exemplo de item: {"id":"...","from_me":false,"text":"...","moment":"2025-09-05T12:34:56Z","status":"RECEIVED","type":"ReceivedCallback","meta":{...}}
  conversa          jsonb       not null default '[]'::jsonb,

  -- Campos de conveniência para listagens/ordenar
  last_message_at   timestamptz not null default now(),
  last_message_text text,
  last_direction    text        not null default 'entrada',
  meta              jsonb       not null default '{}'::jsonb,

  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint whatsapp_conversas_last_direction_chk
    check (last_direction in ('entrada','saida'))
);

-- Evita duplicidade por contato + instância + conexão
create unique index if not exists whatsapp_conversas_uq
  on public.whatsapp_conversas (instance_id, connected_phone, contact_phone);

-- Ordenação comum por atividade
create index if not exists whatsapp_conversas_last_message_at_idx
  on public.whatsapp_conversas (last_message_at desc);

-- Opcional: busca por telefone
create index if not exists whatsapp_conversas_contact_phone_idx
  on public.whatsapp_conversas (contact_phone);

-- Atualiza updated_at automaticamente
drop trigger if exists set_timestamp_whatsapp_conversas on public.whatsapp_conversas;
create trigger set_timestamp_whatsapp_conversas
before update on public.whatsapp_conversas
for each row execute function public.update_updated_at_column();

-- 2) RLS e políticas
alter table public.whatsapp_conversas enable row level security;

-- Admins e diretoria: gerenciam tudo
drop policy if exists whatsapp_conversas_admin_manage on public.whatsapp_conversas;
create policy whatsapp_conversas_admin_manage
  on public.whatsapp_conversas
  as permissive
  for all
  to authenticated
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'diretoria'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'diretoria'::app_role));

-- Supervisores: podem visualizar (para acompanhamento)
drop policy if exists whatsapp_conversas_supervisor_view on public.whatsapp_conversas;
create policy whatsapp_conversas_supervisor_view
  on public.whatsapp_conversas
  as permissive
  for select
  to authenticated
  using (has_role(auth.uid(), 'supervisor'::app_role));
