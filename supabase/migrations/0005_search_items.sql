-- Busca da §4.3: full-text primeiro, trigram como rede de segurança.
--
-- Por que uma função e não query montada no cliente: a regra é "cai no trigram
-- QUANDO o full-text não devolve nada", e isso é uma decisão que depende do
-- resultado da primeira consulta. Fazer no cliente custaria dois round-trips e
-- deixaria o ranking do full-text (ts_rank) inacessível pelo PostgREST.
--
-- `security invoker` (o default) de propósito: a função roda com os direitos de
-- quem chama, então a RLS de `items` continua valendo dentro dela. Uma função
-- `security definer` aqui devolveria o cache de todo mundo.
create or replace function public.search_items(
  p_query text,
  p_include_archived boolean default false,
  p_tag text default null,
  p_limit integer default 30,
  p_offset integer default 0
)
returns setof public.items
language plpgsql
stable
-- `extensions` no search_path porque pg_trgm não mora em public: sem isto,
-- `word_similarity` não resolve.
set search_path = public, extensions
as $$
declare
  normalized text := btrim(coalesce(p_query, ''));
  ts_query tsquery;
  found integer;
begin
  -- Teto de página: sem ele, um cliente pede limit=1000000 e o servidor obedece.
  p_limit := least(greatest(coalesce(p_limit, 30), 1), 100);
  p_offset := greatest(coalesce(p_offset, 0), 0);

  if normalized = '' then
    return;
  end if;

  -- websearch_to_tsquery aceita a sintaxe que o usuário já conhece de buscador
  -- ("aspas para frase", -exclusão) e NUNCA levanta erro de sintaxe — ao
  -- contrário de to_tsquery, que quebraria com um `&` digitado sem querer.
  ts_query := websearch_to_tsquery('portuguese', normalized);

  return query
  select i.*
  from public.items i
  where i.search_vector @@ ts_query
    and (p_include_archived or not i.archived)
    and (p_tag is null or p_tag = any (i.tags))
  order by
    i.pinned desc,
    ts_rank(i.search_vector, ts_query) desc,
    i.created_at desc
  limit p_limit offset p_offset;

  get diagnostics found = row_count;
  if found > 0 then
    return;
  end if;

  -- Fallback trigram. Só entra quando o full-text não achou NADA — e só na
  -- primeira página, porque "não achou nada" não faz sentido no meio de uma
  -- rolagem infinita.
  if p_offset > 0 then
    return;
  end if;

  -- `word_similarity(termo, texto)` e não `similarity(texto, termo)`: o segundo
  -- compara as strings INTEIRAS, então o score despenca conforme o item cresce.
  -- Medido: um item de ~55 caracteres contendo "Kubernetes" dá 0.186 contra a
  -- busca "kubernets" — abaixo do corte de 0.2 — enquanto word_similarity, que
  -- mede o melhor trecho, dá 0.800 no mesmo par. Com `similarity` este fallback
  -- praticamente nunca dispararia, que é o oposto do que a §4.3 quer.
  return query
  select i.*
  from public.items i
  where word_similarity(normalized, i.raw_text) > 0.2
    and (p_include_archived or not i.archived)
    and (p_tag is null or p_tag = any (i.tags))
  order by
    i.pinned desc,
    word_similarity(normalized, i.raw_text) desc,
    i.created_at desc
  limit p_limit offset p_offset;
end;
$$;

-- Tags existentes do dono, para os chips de filtro da §4.3. Feito no banco
-- porque a alternativa — baixar todos os itens para juntar as tags no cliente —
-- não escala e ainda erraria assim que a lista fosse paginada.
create or replace function public.item_tags()
returns table (tag text, count bigint)
language sql
stable
set search_path = public
as $$
  select t.tag, count(*) as count
  from public.items i
  cross join lateral unnest(i.tags) as t(tag)
  where not i.archived
  group by t.tag
  order by count desc, t.tag asc
$$;
