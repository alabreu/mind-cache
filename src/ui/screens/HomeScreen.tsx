import { useEffect, useRef, useState } from 'react'
import { User } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { getUnreadCount } from '@core/changelog'
import { APP_NAME } from '@core/config'
import {
  Button,
  buttonClasses,
  Chip,
  IconButton,
  Screen,
  ScreenBody,
} from '@ui/design'
import {
  CaptureField,
  type CaptureFieldHandle,
} from '@ui/components/CaptureField'
import { ItemRow } from '@ui/components/ItemRow'
import { MenuSheet } from '@ui/components/MenuSheet'
import {
  SearchField,
  type SearchFieldHandle,
} from '@ui/components/SearchField'
import { useAuth } from '@ui/hooks/useAuth'
import { useItems } from '@ui/hooks/useItems'
import { useTranslation } from '@ui/hooks/useTranslation'

/**
 * A tela do produto: captura e busca no topo, cache embaixo (§4.1 a §4.3).
 *
 * Captura e busca ficam FORA do corpo rolável de propósito — são o caminho
 * crítico e não podem sair da tela quando a lista rola.
 */
export function HomeScreen() {
  const { t } = useTranslation()
  const { user, ready, configured } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unread] = useState(() => getUnreadCount())
  const captureRef = useRef<CaptureFieldHandle>(null)
  const searchRef = useRef<SearchFieldHandle>(null)
  const listRef = useRef<HTMLElement>(null)

  const {
    items,
    loading,
    loadingMore,
    hasMore,
    error,
    query,
    setQuery,
    activeQuery,
    searching,
    tag,
    setTag,
    tags,
    includeArchived,
    setIncludeArchived,
    capture,
    retry,
    patch,
    remove,
    loadMore,
    reload,
  } = useItems(user?.id)

  // §7: `/` foca a busca, `n` foca a captura, `Esc` limpa.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null
      const typing =
        target?.isContentEditable ||
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA'

      if (e.key === 'Escape') {
        // Dentro da busca, o Esc é da própria caixa (limpa sem perder o foco).
        if (target?.id === 'search') return
        captureRef.current?.clear()
        setQuery('')
        return
      }

      // Só sequestra a tecla quando ela não está sendo digitada em algum campo,
      // senão escrever "n" numa nota puxaria o foco para a captura.
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return

      if (e.key === 'n') {
        e.preventDefault()
        captureRef.current?.focus()
      } else if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [setQuery])

  // Paginação infinita: carrega mais ao chegar perto do fim da rolagem.
  useEffect(() => {
    const el = listRef.current
    if (!el || !hasMore) return
    function onScroll() {
      if (!el) return
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 400) loadMore()
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [hasMore, loadMore])

  const signedIn = Boolean(user)
  const filtering = searching || tag !== null

  return (
    <Screen>
      <header className="flex items-center justify-between px-gutter pb-2 pt-3">
        <h1 className="text-display font-extrabold tracking-tight">
          {APP_NAME}
        </h1>
        <IconButton
          aria-label={
            unread > 0 ? t('home.menuButtonUnread') : t('home.menuButton')
          }
          onClick={() => setMenuOpen(true)}
          className="relative"
        >
          {user?.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt=""
              className="h-full w-full rounded-control object-cover"
            />
          ) : (
            <User size={20} weight="bold" />
          )}
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-control bg-accent ring-2 ring-bg"
            />
          )}
        </IconButton>
      </header>

      {signedIn && (
        <div className="flex flex-col gap-2 px-gutter pb-2">
          <CaptureField ref={captureRef} onSubmit={capture} />
          <SearchField ref={searchRef} value={query} onChange={setQuery} />

          {tags.length > 0 && (
            <div className="-mx-gutter flex gap-1 overflow-x-auto px-gutter pb-1">
              <Chip selected={tag === null} onClick={() => setTag(null)}>
                {t('search.allTags')}
              </Chip>
              {tags.map((entry) => (
                <Chip
                  key={entry.tag}
                  selected={tag === entry.tag}
                  onClick={() => setTag(tag === entry.tag ? null : entry.tag)}
                  className="whitespace-nowrap"
                >
                  #{entry.tag}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sem login não há cache: a RLS amarra cada item a um dono e a v1 não tem
          modo offline (§6), então guardar só no navegador criaria uma segunda
          fonte da verdade que nunca sincroniza. */}
      {ready && !signedIn ? (
        <ScreenBody as="main" centered>
          {/* Sem as env vars não existe para onde logar: dizer "entre" e não
              oferecer o botão seria um beco sem saída. */}
          <h2 className="text-title font-bold">
            {configured
              ? t('capture.signedOutTitle')
              : t('capture.noBackendTitle')}
          </h2>
          <p className="max-w-xs text-body text-muted">
            {configured
              ? t('capture.signedOutBody')
              : t('capture.noBackendBody')}
          </p>
          {configured && (
            <Link to="/login" className={buttonClasses()}>
              {t('capture.signIn')}
            </Link>
          )}
        </ScreenBody>
      ) : (
        <ScreenBody as="main" ref={listRef}>
          {(items.length > 0 || includeArchived) && (
            <div className="mb-2 flex justify-end">
              <Chip
                selected={includeArchived}
                onClick={() => setIncludeArchived(!includeArchived)}
              >
                {t('items.showArchived')}
              </Chip>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <p className="text-body text-muted">{t('items.loadError')}</p>
              <Button onClick={reload}>{t('items.retryLoad')}</Button>
            </div>
          )}

          {!error && !loading && items.length === 0 && (
            <div className="flex flex-col items-center gap-1 py-12 text-center">
              <p className="text-body font-semibold">
                {filtering ? t('search.noResults') : t('items.empty')}
              </p>
              <p className="text-label text-muted">
                {filtering ? t('search.noResultsHint') : t('items.emptyHint')}
              </p>
            </div>
          )}

          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              query={activeQuery}
              onPatch={(changes) => patch(item.id, changes)}
              onRemove={() => remove(item.id)}
              onRetry={() => retry(item.id)}
            />
          ))}

          {(loading || loadingMore) && (
            <p className="py-4 text-center text-label text-muted">
              {t('items.loading')}
            </p>
          )}
        </ScreenBody>
      )}

      <MenuSheet open={menuOpen} onClose={() => setMenuOpen(false)} />
    </Screen>
  )
}
