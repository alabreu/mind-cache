import { describe, expect, it } from 'vitest'
import { buildBookmarklet, composeDraft } from './share'

describe('composeDraft', () => {
  it('junta título e url quando o compartilhamento manda os dois', () => {
    expect(
      composeDraft({
        title: 'Kubernetes Docs',
        text: '',
        url: 'https://kubernetes.io/docs',
      }),
    ).toBe('Kubernetes Docs\nhttps://kubernetes.io/docs')
  })

  it('não repete o que o texto já contém', () => {
    // Vários apps mandam o texto já com a URL dentro.
    expect(
      composeDraft({
        title: '',
        text: 'olha isso https://exemplo.com/a',
        url: 'https://exemplo.com/a',
      }),
    ).toBe('olha isso https://exemplo.com/a')
  })

  it('deixa a URL por último, para a lista mostrar o texto primeiro', () => {
    expect(
      composeDraft({
        title: 'Título',
        text: 'meu comentário',
        url: 'https://exemplo.com',
      }),
    ).toBe('meu comentário\nTítulo\nhttps://exemplo.com')
  })

  it('devolve vazio quando não veio nada', () => {
    expect(composeDraft({ title: '', text: '  ', url: '' })).toBe('')
  })
})

describe('buildBookmarklet', () => {
  it('aponta para a origin recebida', () => {
    const code = buildBookmarklet('https://mind-cache.app')
    expect(code.startsWith('javascript:')).toBe(true)
    expect(code).toContain("window.open('https://mind-cache.app/?'")
  })

  it('codifica os parâmetros, senão um & no título corta o resto', () => {
    const code = buildBookmarklet('https://x.dev')
    expect(code).toContain('encodeURIComponent(document.title)')
    expect(code).toContain('encodeURIComponent(location.href)')
  })
})
