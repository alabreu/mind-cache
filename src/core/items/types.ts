/** Tipos do domínio do cache. Sem DOM, sem Supabase — ver CLAUDE.md. */

export type ItemSource = 'web' | 'whatsapp'

export interface Item {
  id: string
  rawText: string
  url: string | null
  title: string | null
  note: string | null
  tags: string[]
  source: ItemSource
  pinned: boolean
  archived: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Estado de sincronização de um item na tela. Existe por causa do update
 * otimista da §4.1: o item aparece na lista antes de existir no banco, e uma
 * falha precisa ficar visível NO PRÓPRIO item, com opção de retentar — some da
 * tela sem aviso é como se perde captura.
 */
export type SyncState = 'synced' | 'pending' | 'failed'

/** Item como a lista o enxerga: o do domínio mais o estado de sincronização. */
export interface ListedItem extends Item {
  sync: SyncState
}

/** O que a captura produz. O resto o banco preenche. */
export interface NewItem {
  rawText: string
  url: string | null
  title: string | null
  source: ItemSource
}

/** Campos que a edição inline pode mudar (§4.2). */
export interface ItemPatch {
  title?: string | null
  note?: string | null
  tags?: string[]
  pinned?: boolean
  archived?: boolean
}
