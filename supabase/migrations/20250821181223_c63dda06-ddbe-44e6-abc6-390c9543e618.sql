
-- 1) Bucket de Storage para memórias da base de conhecimento
insert into storage.buckets (id, name, public)
values ('knowledge', 'knowledge', false)
on conflict (id) do nothing;

-- 2) Políticas de acesso ao bucket 'knowledge'
-- Admins: acesso total (SELECT/INSERT/UPDATE/DELETE) apenas neste bucket
create policy if not exists "knowledge_admin_all"
on storage.objects
for all
to authenticated
using (
  bucket_id = 'knowledge'
  and has_role(auth.uid(), 'admin'::app_role)
)
with check (
  bucket_id = 'knowledge'
  and has_role(auth.uid(), 'admin'::app_role)
);

-- Observação: mantemos o bucket privado. Caso deseje leitura para todos autenticados,
-- podemos adicionar uma política SELECT específica depois.

-- 3) Expandir a tabela de artigos da base
alter table public.knowledge_articles
  add column if not exists estilo text,                -- 'manual' | 'diretrizes'
  add column if not exists subcategoria text,          -- subcategoria/classificação fina
  add column if not exists classificacao jsonb,        -- payload estruturado (Manual)
  add column if not exists arquivo_path text;          -- caminho no storage

alter table public.knowledge_articles
  alter column classificacao set default '{}'::jsonb;

-- 4) Índices para filtros e buscas
create index if not exists idx_kb_estilo on public.knowledge_articles(estilo);
create index if not exists idx_kb_categoria on public.knowledge_articles(categoria);
create index if not exists idx_kb_subcategoria on public.knowledge_articles(subcategoria);
