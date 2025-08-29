
-- 0) Extensão pgvector (caso ainda não esteja ativa)
create extension if not exists vector;

-- 1) Tipos ENUM (criados de forma idempotente)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'article_status') then
    create type article_status as enum ('ativo', 'vencido', 'em_revisao', 'arquivado', 'substituido');
  end if;
end$$;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'article_type') then
    create type article_type as enum ('permanente', 'temporario');
  end if;
end$$;

-- 2) Tabela principal documentos
create table if not exists public.documentos (
  id uuid primary key default gen_random_uuid(),
  artigo_id uuid not null default gen_random_uuid(),    -- agrupador lógico de versões
  titulo text not null,
  conteudo jsonb,
  versao int not null default 1,
  parent_id uuid references public.documentos(id),
  tipo article_type not null default 'permanente',
  valido_ate timestamptz,
  tags text[],
  status article_status not null default 'ativo',
  justificativa text not null,
  criado_por uuid not null references public.profiles(id),
  criado_em timestamptz not null default now(),
  embedding vector(3072) not null
);

-- 3) Índices
create index if not exists idx_documentos_artigo_id on public.documentos(artigo_id);
create index if not exists idx_documentos_status on public.documentos(status);
create index if not exists idx_documentos_valido_ate on public.documentos(valido_ate);
create index if not exists idx_documentos_tags on public.documentos using gin (tags);

-- 4) Índice vetorial HNSW para similaridade (L2)
create index if not exists idx_documentos_embedding
  on public.documentos
  using hnsw (embedding vector_l2_ops);

-- 5) Row Level Security
alter table public.documentos enable row level security;

-- Admins/diretoria gerenciam tudo
drop policy if exists documentos_admins_manage on public.documentos;
create policy documentos_admins_manage
  on public.documentos
  for all
  using (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'diretoria'::app_role))
  with check (has_role(auth.uid(), 'admin'::app_role) or has_role(auth.uid(), 'diretoria'::app_role));

-- Autenticados podem ler apenas conteúdo válido (ativo e não expirado)
drop policy if exists documentos_auth_view_valid on public.documentos;
create policy documentos_auth_view_valid
  on public.documentos
  for select
  using (
    auth.uid() is not null
    and status = 'ativo'::article_status
    and (
      tipo = 'permanente'::article_type
      or (tipo = 'temporario'::article_type and (valido_ate is null or valido_ate > now()))
    )
  );

-- Autores podem ver seus próprios documentos (independente de status)
drop policy if exists documentos_author_view_own on public.documentos;
create policy documentos_author_view_own
  on public.documentos
  for select
  using (auth.uid() = criado_por);

-- 6) Função RPC de busca segura por similaridade
create or replace function public.match_documentos(
  query_embedding vector(3072),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  titulo text,
  conteudo jsonb,
  versao int,
  similaridade float
)
language sql
stable
as $$
  select
    d.id,
    d.titulo,
    d.conteudo,
    d.versao,
    1 - (d.embedding <=> query_embedding) as similaridade
  from public.documentos d
  where
    d.status = 'ativo'
    and (
      d.tipo = 'permanente'
      or (d.tipo = 'temporario' and (d.valido_ate is null or d.valido_ate > now()))
    )
    and 1 - (d.embedding <=> query_embedding) > match_threshold
  order by similaridade desc
  limit match_count;
$$;

-- Opcional: Comentários para documentação
comment on table public.documentos is 'Repositório governado de conhecimento com versionamento, ciclo de vida e embedding vector(3072).';
comment on column public.documentos.artigo_id is 'Agrupa versões do mesmo artigo. A primeira versão define o artigo_base.';
comment on column public.documentos.parent_id is 'Aponta para a versão anterior (se houver).';
comment on function public.match_documentos is 'Busca vetorial segura filtrando apenas documentos válidos (status=ativo e não expirados).';
