
-- 1) Tabela de vínculo usuário ↔ equipe
create table if not exists public.equipe_members (
  id uuid primary key default gen_random_uuid(),
  equipe_id uuid not null references public.equipes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member',
  is_primary boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (equipe_id, user_id)
);

-- 2) RLS
alter table public.equipe_members enable row level security;

-- Admins manage all
create policy "Admins manage equipe_members"
  on public.equipe_members
  as restrictive
  for all
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

-- Users can view their own memberships
create policy "Users can view their own equipe memberships"
  on public.equipe_members
  as restrictive
  for select
  using (auth.uid() = user_id);

-- 3) Índices úteis
create index if not exists idx_equipe_members_user on public.equipe_members(user_id);
create index if not exists idx_equipe_members_equipe on public.equipe_members(equipe_id);
create index if not exists idx_equipe_members_active on public.equipe_members(ativo);

-- 4) Trigger para updated_at
drop trigger if exists set_timestamp_equipe_members on public.equipe_members;
create trigger set_timestamp_equipe_members
before update on public.equipe_members
for each row
execute procedure public.update_updated_at_column();
