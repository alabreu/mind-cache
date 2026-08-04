import { supabase } from '@core/backend/client'
import { PAGE_SIZE, toItem, type ItemRow } from './repo'
import type { Item } from './types'

/**
 * Busca (§4.3) e tags existentes, via as funções da migração 0005. A decisão de
 * cair no trigram depende do resultado do full-text, então ela vive no banco —
 * fazer aqui custaria dois round-trips por tecla digitada.
 */

export interface SearchParams {
  query: string
  includeArchived: boolean
  /** Filtro por tag (chips da §4.3). */
  tag: string | null
  page: number
}

export async function searchItems({
  query,
  includeArchived,
  tag,
  page,
}: SearchParams): Promise<Item[]> {
  if (!supabase) throw new Error('backend-not-configured')

  const { data, error } = await supabase.rpc('search_items', {
    p_query: query,
    p_include_archived: includeArchived,
    p_tag: tag,
    p_limit: PAGE_SIZE,
    p_offset: page * PAGE_SIZE,
  })

  if (error) throw new Error(error.message)
  return ((data ?? []) as ItemRow[]).map(toItem)
}

export interface TagCount {
  tag: string
  count: number
}

export async function listTags(): Promise<TagCount[]> {
  if (!supabase) throw new Error('backend-not-configured')

  const { data, error } = await supabase.rpc('item_tags')
  if (error) throw new Error(error.message)
  return ((data ?? []) as { tag: string; count: number }[]).map((row) => ({
    tag: row.tag,
    count: Number(row.count),
  }))
}
