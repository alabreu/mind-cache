import type { Locale } from '@core/i18n'

/**
 * Tempo relativo para a lista (§4.2: "há 3 dias"). Usa `Intl` em vez de tabela
 * de strings no i18n porque plural e gênero de unidade variam por idioma e o
 * runtime já sabe fazer isso — inclusive em idiomas que ninguém previu.
 *
 * `now` é parâmetro, e não `Date.now()` lá dentro, para a função ser pura e
 * testável sem congelar relógio.
 */

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

const UNITS: [limit: number, size: number, unit: Intl.RelativeTimeFormatUnit][] =
  [
    [MINUTE, 1000, 'second'],
    [HOUR, MINUTE, 'minute'],
    [DAY, HOUR, 'hour'],
    [WEEK, DAY, 'day'],
    [MONTH, WEEK, 'week'],
    [YEAR, MONTH, 'month'],
    [Infinity, YEAR, 'year'],
  ]

export function formatRelativeTime(
  iso: string,
  locale: Locale,
  now: number = Date.now(),
): string {
  const then = Date.parse(iso)
  if (Number.isNaN(then)) return ''

  const elapsed = now - then
  const absolute = Math.abs(elapsed)

  // Abaixo de um minuto, "há 40 segundos" é ruído: o que importa é "acabou de
  // entrar". É também o estado logo depois de capturar, que aparece muito.
  if (absolute < MINUTE) {
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      0,
      'second',
    )
  }

  const [, size, unit] = UNITS.find(([limit]) => absolute < limit) ?? UNITS[6]
  const value = Math.round(elapsed / size)

  return new Intl.RelativeTimeFormat(locale, { numeric: 'always' }).format(
    -value,
    unit,
  )
}
