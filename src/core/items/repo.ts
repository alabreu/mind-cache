import { supabase } from '@core/backend/client'
import type { Item, ItemPatch, NewItem } from './types'

/**
 * Acesso à tabela `items` (migração 0004). Passa pela costura de
 * `core/backend/client` como manda o CLAUDE.md — nenhuma tela fala com o
 * Supabase direto.
 *
 * A RLS já filtra por dono, então nenhuma query aqui precisa de `where user_id`
 * para LER. No insert o `user_id` vai explícito porque a policy exige que ele
 * bata com `auth.uid()` — a coluna não tem default.
 */

/** §4.2: paginação infinita, 30 por vez. */
export const PAGE_SIZE = 30

/** Exportado para `search.ts`, que lê as mesmas linhas por RPC. */
export interface ItemRow {
  id: string
  raw_text: string
  url: string | null
  title: string | null
  note: string | null
  tags: string[] | null
  source: string
  pinned: boolean
  archived: boolean
  created_at: string
  updated_at: string
}

const COLUMNS =
  'id, raw_text, url, title, note, tags, source, pinned, archived, created_at, updated_at'

export function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    rawText: row.raw_text,
    url: row.url,
    title: row.title,
    note: row.note,
    tags: row.tags ?? [],
    source: row.source === 'whatsapp' ? 'whatsapp' : 'web',
    pinned: row.pinned,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function client() {
  if (!supabase) throw new Error('backend-not-configured')
  return supabase
}

export interface ListParams {
  /** Página baseada em zero. */
  page: number
  includeArchived: boolean
  /** Chip de tag selecionado, ou null para não filtrar. */
  tag?: string | null
}

/**
 * Uma página da lista, na ordem da §4.2: fixados primeiro, depois cronológico
 * reverso. É a ordenação que o índice `items_pinned_created_idx` serve.
 *
 * Paginação por offset, e não por cursor: com "fixados primeiro" o cursor
 * precisaria carregar as duas chaves e ainda assim pularia item se algo fosse
 * fixado no meio da rolagem. O preço do offset é deslocar a janela quando um
 * item entra durante a rolagem — aqui isso quase não acontece, porque item novo
 * entra na lista por update otimista, não por refetch.
 */
export async function listItems({
  page,
  includeArchived,
  tag = null,
}: ListParams): Promise<Item[]> {
  let query = client()
    .from('items')
    .select(COLUMNS)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1)

  if (!includeArchived) query = query.eq('archived', false)
  // `contains` vira o operador `@>` de array, que o índice GIN de tags serve.
  if (tag) query = query.contains('tags', [tag])

  const { data, error } = await query
  if (error) throw new Error(error.message)
  return (data as ItemRow[]).map(toItem)
}

/**
 * Insere e devolve a linha como o banco a gravou. O retorno importa: o item já
 * está na tela por update otimista com um id temporário, e é isto que troca o
 * temporário pelo id real (sem o real, editar ou apagar em seguida falharia).
 */
export async function createItem(
  input: NewItem,
  userId: string,
): Promise<Item> {
  const { data, error } = await client()
    .from('items')
    .insert({
      user_id: userId,
      raw_text: input.rawText,
      url: input.url,
      title: input.title,
      source: input.source,
    })
    .select(COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  return toItem(data as ItemRow)
}

export async function updateItem(
  id: string,
  patch: ItemPatch,
): Promise<Item> {
  const row: Record<string, unknown> = {}
  if (patch.title !== undefined) row.title = patch.title
  if (patch.note !== undefined) row.note = patch.note
  if (patch.tags !== undefined) row.tags = patch.tags
  if (patch.pinned !== undefined) row.pinned = patch.pinned
  if (patch.archived !== undefined) row.archived = patch.archived

  const { data, error } = await client()
    .from('items')
    .update(row)
    .eq('id', id)
    .select(COLUMNS)
    .single()

  if (error) throw new Error(error.message)
  return toItem(data as ItemRow)
}

export async function deleteItem(id: string): Promise<void> {
  const { error } = await client().from('items').delete().eq('id', id)
  if (error) throw new Error(error.message)
}
