
-- 1) Tabela de solicitações de acesso interno
create table if not exists public.internal_access_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  equipe_id uuid not null,
  desired_role text not null default 'member', -- usar os mesmos valores do UI de equipe_members
  status text not null default 'pending',      -- pending | approved | rejected
  comments text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Índices úteis
create index if not exists idx_iar_user_id on public.internal_access_requests(user_id);
create index if not exists idx_iar_equipe_status on public.internal_access_requests(equipe_id, status);

-- Apenas 1 pendência por user/equipe
create unique index if not exists uq_iar_user_equipe_pending
  on public.internal_access_requests(user_id, equipe_id)
  where status = 'pending';

-- Trigger para atualizar updated_at
drop trigger if exists trg_iar_updated_at on public.internal_access_requests;
create trigger trg_iar_updated_at
before update on public.internal_access_requests
for each row
execute procedure public.update_updated_at_column();

-- 2) RLS
alter table public.internal_access_requests enable row level security;

-- Usuário vê as próprias solicitações
drop policy if exists "IAR: users can view own" on public.internal_access_requests;
create policy "IAR: users can view own"
  on public.internal_access_requests
  for select
  using (auth.uid() = user_id);

-- Usuário cria a própria solicitação
drop policy if exists "IAR: users can insert own" on public.internal_access_requests;
create policy "IAR: users can insert own"
  on public.internal_access_requests
  for insert
  with check (auth.uid() = user_id);

-- Admin gerencia tudo
drop policy if exists "IAR: admins manage all" on public.internal_access_requests;
create policy "IAR: admins manage all"
  on public.internal_access_requests
  for all
  using (has_role(auth.uid(), 'admin'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role));

-- 3) RPC: Aprovar solicitação
create or replace function public.approve_internal_access(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
  already_exists boolean;
begin
  -- Garantir que quem chama é admin (compatível com RLS/políticas)
  if not has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'Acesso negado';
  end if;

  select * into req
  from public.internal_access_requests
  where id = p_request_id;

  if not found then
    raise exception 'Solicitação não encontrada';
  end if;

  if req.status <> 'pending' then
    raise exception 'Solicitação já processada (status=%).', req.status;
  end if;

  -- Verifica se já existe vínculo ativo
  select exists (
    select 1
      from public.equipe_members em
     where em.user_id = req.user_id
       and em.equipe_id = req.equipe_id
  ) into already_exists;

  if not already_exists then
    insert into public.equipe_members (user_id, equipe_id, role, is_primary, ativo)
    values (req.user_id, req.equipe_id, coalesce(req.desired_role, 'member'), false, true);
  end if;

  update public.internal_access_requests
     set status = 'approved',
         decided_by = auth.uid(),
         decided_at = now()
   where id = p_request_id;
end;
$$;

-- 4) RPC: Recusar solicitação
create or replace function public.reject_internal_access(p_request_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req record;
begin
  if not has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'Acesso negado';
  end if;

  select * into req
  from public.internal_access_requests
  where id = p_request_id;

  if not found then
    raise exception 'Solicitação não encontrada';
  end if;

  if req.status <> 'pending' then
    raise exception 'Solicitação já processada (status=%).', req.status;
  end if;

  update public.internal_access_requests
     set status = 'rejected',
         comments = coalesce(p_reason, comments),
         decided_by = auth.uid(),
         decided_at = now()
   where id = p_request_id;
end;
$$;
