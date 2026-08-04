import { useEffect, useRef } from 'react'
import { buildBookmarklet } from '@core/items/share'
import { Card, Screen, ScreenBody, SectionTitle } from '@ui/design'
import { ScreenHeader } from '@ui/components/ScreenHeader'
import { useTranslation } from '@ui/hooks/useTranslation'

/**
 * Configurações. Hoje só o bookmarklet da §4.4 — a captura a partir do
 * desktop, onde o `share_target` do sistema não existe.
 *
 * O link é montado com `href` via DOM e não em JSX porque `javascript:` num
 * atributo de JSX é exatamente o padrão que os linters de segurança procuram;
 * aqui ele é o produto, não um descuido, e isolar num `useEffect` deixa isso
 * explícito em vez de exigir um disable espalhado.
 */
export function SettingsScreen() {
  const { t } = useTranslation()
  const linkRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    linkRef.current?.setAttribute(
      'href',
      buildBookmarklet(window.location.origin),
    )
  }, [])

  return (
    <Screen>
      <ScreenHeader title={t('settings.title')} />
      <ScreenBody as="main">
        <SectionTitle>{t('settings.bookmarkletTitle')}</SectionTitle>
        <Card padding="md" bordered>
          <p className="text-body text-muted">
            {t('settings.bookmarkletBody')}
          </p>
          <p className="mt-3">
            {/* Arrastar é o uso pretendido: clicar aqui dentro do próprio app
                não faria nada útil. */}
            <a
              ref={linkRef}
              href="/"
              draggable
              onClick={(e) => e.preventDefault()}
              className="inline-flex items-center rounded-control bg-primary px-4 py-2 text-body font-semibold text-on-primary"
            >
              {t('settings.bookmarkletLabel')}
            </a>
          </p>
          <p className="mt-3 text-label text-muted">
            {t('settings.bookmarkletHint')}
          </p>
        </Card>

        <SectionTitle>{t('settings.installTitle')}</SectionTitle>
        <Card padding="md" bordered>
          <p className="text-body text-muted">{t('settings.installBody')}</p>
        </Card>
      </ScreenBody>
    </Screen>
  )
}
