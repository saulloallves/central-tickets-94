
-- 1) Conceder permissão global de tickets para o papel 'colaborador'
insert into public.role_permissions (role, permission)
select 'colaborador'::app_role, 'view_all_tickets'::app_permission
where not exists (
  select 1 from public.role_permissions
  where role = 'colaborador'::app_role
    and permission = 'view_all_tickets'::app_permission
);

-- 2) Atualizar funções centrais de acesso a tickets
-- Versão 1: somente unidade (mantém lógica atual + permissão global)
create or replace function public.can_view_ticket(ticket_unidade_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select 
    public.has_role(auth.uid(), 'admin'::app_role) or
    public.has_permission(auth.uid(), 'view_all_tickets'::app_permission) or
    (
      public.has_role(auth.uid(), 'gerente'::app_role) and
      ticket_unidade_id in (
        select u.id
          from public.unidades u
          join public.franqueados f on f.unit_code ? u.id
          join public.profiles p on p.email = f.email
         where p.id = auth.uid()
      )
    ) or
    (
      ticket_unidade_id in (
        select c.unidade_id
          from public.colaboradores c
          join public.profiles p on p.email = c.email
         where p.id = auth.uid()
      )
    )
$$;

-- Versão 2: unidade + equipe (mantém lógica atual + permissão global)
create or replace function public.can_view_ticket(ticket_unidade_id text, ticket_equipe_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select 
    public.has_role(auth.uid(), 'admin'::app_role) or
    public.has_permission(auth.uid(), 'view_all_tickets'::app_permission) or
    (
      public.has_role(auth.uid(), 'gerente'::app_role) and
      ticket_unidade_id in (
        select u.id
          from public.unidades u
          join public.franqueados f on f.unit_code ? u.id
          join public.profiles p on p.email = f.email
         where p.id = auth.uid()
      )
    ) or
    (
      ticket_unidade_id in (
        select c.unidade_id
          from public.colaboradores c
          join public.profiles p on p.email = c.email
         where p.id = auth.uid()
      )
    ) or
    (
      ticket_equipe_id is not null and
      public.is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$$;

-- Atualizar can_update_ticket para também aceitar a permissão global
create or replace function public.can_update_ticket(ticket_unidade_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select 
    public.has_role(auth.uid(), 'admin'::app_role) or
    public.has_permission(auth.uid(), 'view_all_tickets'::app_permission) or
    (
      public.has_role(auth.uid(), 'gerente'::app_role) and
      ticket_unidade_id in (
        select u.id
          from public.unidades u
          join public.franqueados f on f.unit_code ? u.id
          join public.profiles p on p.email = f.email
         where p.id = auth.uid()
      )
    )
$$;

create or replace function public.can_update_ticket(ticket_unidade_id text, ticket_equipe_id uuid default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select 
    public.has_role(auth.uid(), 'admin'::app_role) or
    public.has_permission(auth.uid(), 'view_all_tickets'::app_permission) or
    (
      public.has_role(auth.uid(), 'gerente'::app_role) and
      ticket_unidade_id in (
        select u.id
          from public.unidades u
          join public.franqueados f on f.unit_code ? u.id
          join public.profiles p on p.email = f.email
         where p.id = auth.uid()
      )
    ) or
    (
      ticket_equipe_id is not null and
      public.is_active_member_of_equipe(auth.uid(), ticket_equipe_id)
    )
$$;

-- 3) RLS para UNIDADES: permitir SELECT para quem tiver a permissão global
-- Obs: Se a tabela já tiver RLS habilitada, o comando abaixo é idempotente.
alter table public.unidades enable row level security;

-- Admins gerenciam tudo
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'unidades' and policyname = 'Admins manage unidades'
  ) then
    create policy "Admins manage unidades"
      on public.unidades
      for all
      using (public.has_role(auth.uid(), 'admin'::app_role))
      with check (public.has_role(auth.uid(), 'admin'::app_role));
  end if;
end $$;

-- Diretoria pode ver tudo (opcional, mantém comportamento amplo para diretoria)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'unidades' and policyname = 'Diretoria view all unidades'
  ) then
    create policy "Diretoria view all unidades"
      on public.unidades
      for select
      using (public.has_role(auth.uid(), 'diretoria'::app_role));
  end if;
end $$;

-- Gerentes veem unidades que gerenciam (consistente com funções)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'unidades' and policyname = 'Gerentes view managed unidades'
  ) then
    create policy "Gerentes view managed unidades"
      on public.unidades
      for select
      using (
        public.has_role(auth.uid(), 'gerente'::app_role) and
        id in (
          select u.id
            from public.unidades u
            join public.franqueados f on f.unit_code ? u.id
            join public.profiles p on p.email = f.email
           where p.id = auth.uid()
        )
      );
  end if;
end $$;

-- Colaboradores veem sua unidade (mantém compatibilidade)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'unidades' and policyname = 'Colaboradores view own unidade'
  ) then
    create policy "Colaboradores view own unidade"
      on public.unidades
      for select
      using (
        id in (
          select c.unidade_id
            from public.colaboradores c
            join public.profiles p on p.email = c.email
           where p.id = auth.uid()
        )
      );
  end if;
end $$;

-- Atendentes (via permissão) veem todas as unidades
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'unidades' and policyname = 'Atendentes view all unidades (permission)'
  ) then
    create policy "Atendentes view all unidades (permission)"
      on public.unidades
      for select
      using (public.has_permission(auth.uid(), 'view_all_tickets'::app_permission));
  end if;
end $$;

-- 4) RLS para FRANQUEADOS: permitir SELECT para quem tiver a permissão global
-- Há políticas existentes (Admins manage franqueados, Franqueados view own data).
-- Vamos acrescentar uma policy para atendentes e, opcionalmente, diretoria.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'franqueados' and policyname = 'Atendentes view all franqueados (permission)'
  ) then
    create policy "Atendentes view all franqueados (permission)"
      on public.franqueados
      for select
      using (public.has_permission(auth.uid(), 'view_all_tickets'::app_permission));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'franqueados' and policyname = 'Diretoria view all franqueados'
  ) then
    create policy "Diretoria view all franqueados"
      on public.franqueados
      for select
      using (public.has_role(auth.uid(), 'diretoria'::app_role));
  end if;
end $$;
