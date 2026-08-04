import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createItem,
  deleteItem,
  listItems,
  PAGE_SIZE,
  updateItem,
} from '@core/items/repo'
import { fetchTitle } from '@core/items/title'
import type { Item, ItemPatch, ListedItem } from '@core/items/types'
import { extractUrl } from '@core/items/url'

/**
 * Estado da lista + captura otimista (§4.1 e §4.2).
 *
 * O update otimista é o ponto delicado: o item entra na tela ANTES de existir
 * no banco, com um id temporário. Enquanto está assim ele não pode ser editado
 * nem apagado no servidor (o id não existe lá), e se o insert falhar ele tem
 * que continuar visível e retentável — sumir da tela é perder captura, que é
 * exatamente o que este app não pode fazer.
 *
 * `loading` é DERIVADO (a chave carregada difere da chave pedida) em vez de ser
 * um estado que o effect liga. Além de evitar o setState síncrono dentro do
 * effect, some a janela de um render em que a lista antiga aparece como se
 * fosse a nova.
 */

let tempCounter = 0
const TEMP_PREFIX = 'temp:'

function tempId(): string {
  tempCounter += 1
  return `${TEMP_PREFIX}${tempCounter}`
}

function isTemp(id: string): boolean {
  return id.startsWith(TEMP_PREFIX)
}

function toListed(item: Item): ListedItem {
  return { ...item, sync: 'synced' }
}

interface LoadedState {
  /** Qual combinação de usuário/filtro/reload estas linhas representam. */
  key: string
  /** De quem são estas linhas — ver o carry-over das capturas pendentes. */
  userId: string | undefined
  items: ListedItem[]
  hasMore: boolean
  error: boolean
}

const EMPTY: LoadedState = {
  key: '',
  userId: undefined,
  items: [],
  hasMore: false,
  error: false,
}

export interface UseItems {
  items: ListedItem[]
  loading: boolean
  loadingMore: boolean
  hasMore: boolean
  error: boolean
  includeArchived: boolean
  setIncludeArchived: (value: boolean) => void
  capture: (text: string) => void
  retry: (id: string) => void
  patch: (id: string, patch: ItemPatch) => void
  remove: (id: string) => void
  loadMore: () => void
  reload: () => void
}

export function useItems(userId: string | undefined): UseItems {
  const [includeArchived, setIncludeArchived] = useState(false)
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<LoadedState>(EMPTY)
  const [loadingMore, setLoadingMore] = useState(false)

  const key = `${userId ?? ''}|${includeArchived}|${nonce}`
  const loading = Boolean(userId) && state.key !== key

  const page = useRef(0)
  // Guarda o texto cru de cada captura pendente, para o retry poder reenviar
  // exatamente o que foi digitado mesmo depois de a tela remontar.
  const drafts = useRef(new Map<string, string>())
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Primeira página sempre que muda o usuário, o filtro de arquivados ou o
  // pedido explícito de recarregar.
  useEffect(() => {
    // Deslogado não tem o que buscar, e a lista já sai vazia por derivação —
    // nada de setState aqui.
    if (!userId) return

    let cancelled = false
    page.current = 0

    listItems({ page: 0, includeArchived })
      .then((rows) => {
        if (cancelled) return
        setState((current) => ({
          key,
          userId,
          // Captura que ainda não sincronizou não está no banco — preservá-la no
          // topo, senão um refetch no meio do envio apaga o que acabou de ser
          // digitado. Só vale para o MESMO dono: pendência de uma sessão
          // anterior não pode reaparecer na conta de outra pessoa.
          items: [
            ...(current.userId === userId
              ? current.items.filter((item) => isTemp(item.id))
              : []),
            ...rows.map(toListed),
          ],
          hasMore: rows.length === PAGE_SIZE,
          error: false,
        }))
      })
      .catch(() => {
        if (cancelled) return
        setState((current) => ({
          ...current,
          key,
          userId,
          hasMore: false,
          error: true,
        }))
      })

    return () => {
      cancelled = true
    }
  }, [key, userId, includeArchived])

  /** Troca um item pelo resultado de `next`, ignorando quem já sumiu da lista. */
  const replaceItem = useCallback(
    (id: string, next: (item: ListedItem) => ListedItem) => {
      setState((current) => ({
        ...current,
        items: current.items.map((item) =>
          item.id === id ? next(item) : item,
        ),
      }))
    },
    [],
  )

  /**
   * Envia (ou reenvia) uma captura. Duas etapas separadas de propósito: o
   * insert é o que não pode falhar em silêncio, e o título é enfeite que chega
   * depois — se o fetch demorar ou falhar, o item já está salvo e visível.
   */
  const send = useCallback(
    async (id: string, text: string, url: string | null) => {
      if (!userId) return
      try {
        const saved = await createItem(
          { rawText: text, url, title: null, source: 'web' },
          userId,
        )
        if (!alive.current) return
        drafts.current.delete(id)
        replaceItem(id, () => toListed(saved))

        if (!url) return
        const title = await fetchTitle(url)
        if (!title || !alive.current) return
        const withTitle = await updateItem(saved.id, { title })
        if (alive.current) replaceItem(saved.id, () => toListed(withTitle))
      } catch {
        if (alive.current) {
          replaceItem(id, (item) => ({ ...item, sync: 'failed' }))
        }
      }
    },
    [userId, replaceItem],
  )

  const capture = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !userId) return

      const id = tempId()
      const url = extractUrl(trimmed)
      const now = new Date().toISOString()

      drafts.current.set(id, trimmed)
      setState((current) => ({
        ...current,
        items: [
          {
            id,
            rawText: trimmed,
            url,
            title: null,
            note: null,
            tags: [],
            source: 'web',
            pinned: false,
            archived: false,
            createdAt: now,
            updatedAt: now,
            sync: 'pending',
          },
          ...current.items,
        ],
      }))

      void send(id, trimmed, url)
    },
    [userId, send],
  )

  const retry = useCallback(
    (id: string) => {
      const text = drafts.current.get(id)
      if (!text) return
      replaceItem(id, (item) => ({ ...item, sync: 'pending' }))
      void send(id, text, extractUrl(text))
    },
    [replaceItem, send],
  )

  /**
   * Edição inline. Aplica na tela primeiro e reverte se o servidor recusar —
   * fixar ou arquivar precisa responder na hora, não depois do round-trip.
   */
  const patch = useCallback(
    (id: string, changes: ItemPatch) => {
      if (isTemp(id)) return
      let previous: ListedItem | undefined
      setState((current) => ({
        ...current,
        items: current.items.map((item) => {
          if (item.id !== id) return item
          previous = item
          return { ...item, ...changes }
        }),
      }))

      void updateItem(id, changes)
        .then((saved) => {
          if (alive.current) replaceItem(id, () => toListed(saved))
        })
        .catch(() => {
          if (!alive.current || !previous) return
          const restore = previous
          replaceItem(id, () => restore)
        })
    },
    [replaceItem],
  )

  const remove = useCallback((id: string) => {
    let removed: { item: ListedItem; index: number } | undefined
    setState((current) => {
      const index = current.items.findIndex((item) => item.id === id)
      if (index >= 0) removed = { item: current.items[index], index }
      return {
        ...current,
        items: current.items.filter((item) => item.id !== id),
      }
    })
    drafts.current.delete(id)

    // Item que nunca chegou ao banco: apagar da tela já é apagar.
    if (isTemp(id)) return

    void deleteItem(id).catch(() => {
      // Devolve para a mesma posição — reaparecer no topo faria parecer que o
      // item foi recriado agora.
      if (!alive.current || !removed) return
      const { item, index } = removed
      setState((current) => {
        const items = [...current.items]
        items.splice(Math.min(index, items.length), 0, item)
        return { ...current, items }
      })
    })
  }, [])

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !state.hasMore || !userId) return
    const next = page.current + 1
    setLoadingMore(true)
    listItems({ page: next, includeArchived })
      .then((rows) => {
        if (!alive.current) return
        page.current = next
        setState((current) => {
          const seen = new Set(current.items.map((item) => item.id))
          return {
            ...current,
            items: [
              ...current.items,
              ...rows.map(toListed).filter((item) => !seen.has(item.id)),
            ],
            hasMore: rows.length === PAGE_SIZE,
          }
        })
      })
      .catch(() => {
        // Falhar ao carregar MAIS não é o mesmo que falhar ao carregar: o que já
        // está na tela continua válido. Só para de pedir mais.
        if (alive.current) setState((current) => ({ ...current, hasMore: false }))
      })
      .finally(() => {
        if (alive.current) setLoadingMore(false)
      })
  }, [loading, loadingMore, state.hasMore, userId, includeArchived])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  // Deslogado enxerga lista vazia sem precisar limpar o estado: a tela de
  // login cobre a lista de qualquer jeito, e assim quem sai e volta na mesma
  // conta reencontra o que já estava carregado.
  const signedIn = Boolean(userId)

  return {
    items: signedIn ? state.items : [],
    loading,
    loadingMore,
    hasMore: signedIn && state.hasMore,
    error: signedIn && state.error,
    includeArchived,
    setIncludeArchived,
    capture,
    retry,
    patch,
    remove,
    loadMore,
    reload,
  }
}
