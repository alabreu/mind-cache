import { useEffect, useState } from 'react'
import {
  ArrowClockwise,
  ArrowSquareOut,
  Copy,
  PushPin,
  PushPinSlash,
  Trash,
  Archive,
  ArrowCounterClockwise,
} from '@phosphor-icons/react'
import { highlight } from '@core/items/highlight'
import { formatRelativeTime } from '@core/items/relativeTime'
import type { ItemPatch, ListedItem } from '@core/items/types'
import { domainOf } from '@core/items/url'
import { Card, Field, IconButton, Input, Textarea } from '@ui/design'
import { useTranslation } from '@ui/hooks/useTranslation'

/**
 * Uma linha da lista (§4.2). Fechada mostra o essencial para decidir se é o
 * item procurado; aberta vira o formulário de edição do próprio item.
 *
 * O corpo fechado é um `<button>` e as ações ficam FORA dele: botão dentro de
 * botão é HTML inválido e o leitor de tela perde as ações.
 */

/** Quanto do texto cru aparece fechado — a spec pede "as primeiras ~2 linhas". */
const PREVIEW_CHARS = 140

export interface ItemRowProps {
  item: ListedItem
  /** Busca ativa, para realçar os termos (§4.3). Vazio quando não há busca. */
  query?: string
  onPatch: (patch: ItemPatch) => void
  onRemove: () => void
  onRetry: () => void
}

/**
 * Texto com os termos da busca realçados. Renderiza pedaços em vez de injetar
 * HTML: `dangerouslySetInnerHTML` com texto capturado pelo usuário seria um XSS
 * direto, e o realce não vale esse preço.
 */
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>
  return (
    <>
      {highlight(text, query).map((segment, index) =>
        segment.match ? (
          <mark key={index} className="bg-accent/25 text-ink">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}

export function ItemRow({
  item,
  query = '',
  onPatch,
  onRemove,
  onRetry,
}: ItemRowProps) {
  const { t, locale } = useTranslation()
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(timer)
  }, [copied])

  const domain = item.url ? domainOf(item.url) : null
  const heading = item.title?.trim() || preview(item.rawText)
  // Item que ainda não existe no banco não pode ser editado nem apagado lá.
  const pending = item.sync === 'pending'
  const failed = item.sync === 'failed'

  async function copy() {
    try {
      await navigator.clipboard.writeText(item.url ?? item.rawText)
      setCopied(true)
    } catch {
      // Sem permissão de clipboard: silêncio é melhor que um alerta inútil.
    }
  }

  return (
    <Card as="article" padding="sm" className="mb-2">
      <div className="flex items-start gap-2">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left"
        >
          <p className="line-clamp-2 text-body font-semibold text-ink">
            <Highlighted text={heading} query={query} />
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-label text-muted">
            {domain && <span>{domain}</span>}
            <span>{formatRelativeTime(item.createdAt, locale)}</span>
            {item.source === 'whatsapp' && (
              <span>{t('items.fromWhatsapp')}</span>
            )}
            {item.archived && <span>{t('items.archivedBadge')}</span>}
          </p>
          {item.tags.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1 text-label text-muted">
              {item.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </p>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-1">
          {failed ? (
            <IconButton aria-label={t('items.retrySave')} onClick={onRetry}>
              <ArrowClockwise size={18} weight="bold" />
            </IconButton>
          ) : (
            <>
              <IconButton
                aria-label={copied ? t('items.copied') : t('items.copy')}
                onClick={() => void copy()}
              >
                <Copy size={18} weight={copied ? 'fill' : 'bold'} />
              </IconButton>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label={t('items.open')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-control text-ink"
                >
                  <ArrowSquareOut size={18} weight="bold" />
                </a>
              )}
              <IconButton
                aria-label={item.pinned ? t('items.unpin') : t('items.pin')}
                aria-pressed={item.pinned}
                disabled={pending}
                onClick={() => onPatch({ pinned: !item.pinned })}
              >
                {item.pinned ? (
                  <PushPinSlash size={18} weight="bold" />
                ) : (
                  <PushPin size={18} weight="bold" />
                )}
              </IconButton>
            </>
          )}
        </div>
      </div>

      {(pending || failed) && (
        <p role="status" className="mt-1 text-label text-muted">
          {pending ? t('items.pending') : t('items.failed')}
        </p>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-3">
          <p className="whitespace-pre-wrap break-words text-body text-ink">
            <Highlighted text={item.rawText} query={query} />
          </p>

          <Field label={t('items.titleLabel')}>
            {(id) => (
              <Input
                id={id}
                defaultValue={item.title ?? ''}
                disabled={pending}
                placeholder={t('items.titlePlaceholder')}
                // Salva ao sair do campo, não a cada tecla: um insert por
                // caractere digitado não serve a ninguém.
                onBlur={(e) =>
                  commit(item.title, e.target.value, (value) =>
                    onPatch({ title: value }),
                  )
                }
              />
            )}
          </Field>

          <Field label={t('items.noteLabel')}>
            {(id) => (
              <Textarea
                id={id}
                rows={3}
                defaultValue={item.note ?? ''}
                disabled={pending}
                placeholder={t('items.notePlaceholder')}
                onBlur={(e) =>
                  commit(item.note, e.target.value, (value) =>
                    onPatch({ note: value }),
                  )
                }
              />
            )}
          </Field>

          <Field label={t('items.tagsLabel')}>
            {(id) => (
              <Input
                id={id}
                defaultValue={item.tags.join(', ')}
                disabled={pending}
                placeholder={t('items.tagsPlaceholder')}
                onBlur={(e) => {
                  const tags = parseTags(e.target.value)
                  if (sameTags(tags, item.tags)) return
                  onPatch({ tags })
                }}
              />
            )}
          </Field>

          <div className="flex items-center gap-1">
            <IconButton
              aria-label={
                item.archived ? t('items.unarchive') : t('items.archive')
              }
              disabled={pending}
              onClick={() => onPatch({ archived: !item.archived })}
            >
              {item.archived ? (
                <ArrowCounterClockwise size={18} weight="bold" />
              ) : (
                <Archive size={18} weight="bold" />
              )}
            </IconButton>
            <IconButton aria-label={t('items.delete')} onClick={onRemove}>
              <Trash size={18} weight="bold" />
            </IconButton>
          </div>
        </div>
      )}
    </Card>
  )
}

function preview(text: string): string {
  const flat = text.trim()
  return flat.length > PREVIEW_CHARS
    ? `${flat.slice(0, PREVIEW_CHARS).trimEnd()}…`
    : flat
}

/** Só grava quando mudou de fato, e trata "campo vazio" como nulo. */
function commit(
  current: string | null,
  next: string,
  apply: (value: string | null) => void,
): void {
  const value = next.trim() || null
  if (value === (current?.trim() || null)) return
  apply(value)
}

function parseTags(value: string): string[] {
  const seen = new Set<string>()
  for (const raw of value.split(',')) {
    const tag = raw.trim().replace(/^#/, '').toLowerCase()
    if (tag) seen.add(tag)
  }
  return [...seen]
}

function sameTags(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((tag, i) => tag === b[i])
}
