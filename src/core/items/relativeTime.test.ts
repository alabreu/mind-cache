import { describe, expect, it } from 'vitest'
import { formatRelativeTime } from './relativeTime'

const NOW = Date.parse('2026-08-04T12:00:00Z')

function ago(ms: number): string {
  return new Date(NOW - ms).toISOString()
}

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

describe('formatRelativeTime', () => {
  it('trata o que acabou de entrar como "agora"', () => {
    expect(formatRelativeTime(ago(3 * SECOND), 'pt', NOW)).toBe('agora')
  })

  it('formata minutos, horas e dias', () => {
    expect(formatRelativeTime(ago(5 * MINUTE), 'pt', NOW)).toBe('há 5 minutos')
    expect(formatRelativeTime(ago(3 * HOUR), 'pt', NOW)).toBe('há 3 horas')
    expect(formatRelativeTime(ago(3 * DAY), 'pt', NOW)).toBe('há 3 dias')
  })

  it('sobe de unidade conforme envelhece', () => {
    expect(formatRelativeTime(ago(10 * DAY), 'pt', NOW)).toBe('há 1 semana')
    expect(formatRelativeTime(ago(60 * DAY), 'pt', NOW)).toBe('há 2 meses')
    expect(formatRelativeTime(ago(400 * DAY), 'pt', NOW)).toBe('há 1 ano')
  })

  it('respeita o idioma', () => {
    expect(formatRelativeTime(ago(3 * DAY), 'en', NOW)).toBe('3 days ago')
  })

  it('não quebra com data inválida', () => {
    expect(formatRelativeTime('não é data', 'pt', NOW)).toBe('')
  })
})
