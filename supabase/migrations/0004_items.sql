-- Tabela central do Mind Cache: tudo que é capturado vira uma linha aqui,
-- venha da web ou do WhatsApp. Single-user por design, mas com `user_id` e RLS
-- desde o início — sem isso, ligar o app na internet significa vazar o cache
-- inteiro, e retrofitar RLS depois é bem mais caro que nascer com ela.

-- Busca parcial e erro de digitação. O full-text sozinho não cobre: o
-- dicionário 'portuguese' faz stemming ruim em termo técnico em inglês
-- ("kubernetes", "webhook"), e é justamente esse tipo de termo que vai ser
-- procurado. O trigram é a rede de segurança embaixo dele.
-- Vai para `extensions` (e não `public`) por convenção do Supabase — os
-- advisors reclamam de extensão em public.
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- O que foi digitado/colado, sem tratamento. É a fonte da verdade: url,
  -- title e note são derivados ou editados, este não.
  raw_text text not null check (char_length(raw_text) <= 20000),

  -- Extraídos ou editados à mão. `title` pode vir do <title> da página.
  url text check (char_length(url) <= 2000),
  title text check (char_length(title) <= 500),
  note text check (char_length(note) <= 10000),
  tags text[] not null default '{}',

  source text not null default 'web' check (source in ('web', 'whatsapp')),
  -- message_id do WhatsApp. Serve à idempotência do webhook (ver índice único
  -- parcial abaixo); nulo para captura pela web.
  external_id text check (char_length(external_id) <= 200),

  pinned boolean not null default false,
  archived boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Não usado na v1. Existe desde já porque a v3 (sugerir arquivamento do que
  -- nunca foi acessado) depende dela, e adicionar coluna em tabela grande
  -- depois é mais caro do que carregar uma coluna nula agora.
  last_accessed_at timestamptz,

  search_vector tsvector generated always as (
    to_tsvector('portuguese',
      coalesce(title, '') || ' ' || coalesce(raw_text, '') || ' ' || coalesce(note, '')
    )
  ) stored
);

create index if not exists items_search_idx
  on public.items using gin (search_vector);

-- Serve tanto `%` (similarity) quanto `<%` (word_similarity) quanto LIKE.
--
-- ATENÇÃO ao consultar: `similarity(raw_text, termo)` compara as strings
-- INTEIRAS, então o score cai conforme o item cresce — medido aqui, um item de
-- ~55 caracteres contendo "Kubernetes" dá 0.186 contra a busca "kubernets",
-- abaixo do corte de 0.2 que a spec previa. Use `word_similarity(termo,
-- raw_text)`, que mede o melhor trecho: o mesmo par dá 0.800.
--
-- E qualifique com `extensions.`: pg_trgm não está no schema public, então
-- `similarity(...)` cru só resolve se o search_path da sessão incluir
-- `extensions`. Em função security definer, fixe o search_path.
create index if not exists items_trgm_idx
  on public.items using gin (raw_text extensions.gin_trgm_ops);

create index if not exists items_created_idx
  on public.items (user_id, created_at desc);

-- A lista da v1 ordena pinned primeiro e depois cronológico reverso (§4.2), com
-- paginação de 30. Este índice serve essa ordenação exata; o items_created_idx
-- acima continua servindo qualquer consulta puramente cronológica.
create index if not exists items_pinned_created_idx
  on public.items (user_id, pinned desc, created_at desc);

create index if not exists items_tags_idx
  on public.items using gin (tags);

-- Idempotência do webhook. A Meta reenvia a entrega quando não recebe 200 a
-- tempo, e reenvio é o caso normal, não a exceção — sem esta restrição o mesmo
-- recado vira dois itens. Parcial porque a captura web tem external_id nulo e
-- nulo não deve colidir com nulo.
create unique index if not exists items_external_idx
  on public.items (source, external_id)
  where external_id is not null;

-- `updated_at` no banco, não no cliente: o webhook e o app escrevem pela mesma
-- tabela e um relógio de cliente errado (ou um insert que esqueceu o campo)
-- deixaria a coluna mentindo.
create or replace function public.touch_items_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists items_touch_updated_at on public.items;
create trigger items_touch_updated_at
  before update on public.items
  for each row
  execute function public.touch_items_updated_at();

alter table public.items enable row level security;

-- Dono vê e mexe só no que é dele. O `with check` é tão necessário quanto o
-- `using`: sem ele dá para inserir (ou reatribuir por update) uma linha com
-- user_id de outra pessoa.
drop policy if exists "own items" on public.items;
create policy "own items"
  on public.items for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
