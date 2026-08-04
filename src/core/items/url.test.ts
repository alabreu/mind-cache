import { describe, expect, it } from 'vitest'
import { domainOf, extractUrl } from './url'

describe('extractUrl', () => {
  it('não acha URL em texto puro', () => {
    expect(extractUrl('ideia: cache que sugere o que arquivar')).toBeNull()
  })

  it('extrai a URL de uma captura com comentário junto', () => {
    expect(
      extractUrl('ler depois https://kubernetes.io/docs sobre webhook'),
    ).toBe('https://kubernetes.io/docs')
  })

  it('corta a pontuação que fecha a frase', () => {
    expect(extractUrl('achei em https://exemplo.com/artigo.')).toBe(
      'https://exemplo.com/artigo',
    )
    expect(extractUrl('(veja https://exemplo.com/a)')).toBe(
      'https://exemplo.com/a',
    )
  })

  it('preserva o parêntese que faz parte da própria URL', () => {
    // Cortar aqui quebra o link — é o caso clássico da Wikipédia.
    expect(
      extractUrl('https://pt.wikipedia.org/wiki/Cache_(computação)'),
    ).toBe('https://pt.wikipedia.org/wiki/Cache_(computação)')
  })

  it('fica com a primeira quando há mais de uma', () => {
    expect(extractUrl('https://a.com vs https://b.com')).toBe('https://a.com')
  })

  it('ignora domínio sem esquema, para não confundir com fim de frase', () => {
    expect(extractUrl('vou ali.volto já')).toBeNull()
    expect(extractUrl('www.exemplo.com')).toBeNull()
  })

  it('ignora host sem ponto (localhost não é captura)', () => {
    expect(extractUrl('roda em http://localhost:5173')).toBeNull()
  })

  it('aceita query string e fragmento', () => {
    expect(extractUrl('https://exemplo.com/busca?q=cache&p=2#topo')).toBe(
      'https://exemplo.com/busca?q=cache&p=2#topo',
    )
  })
})

describe('domainOf', () => {
  it('devolve o host sem www', () => {
    expect(domainOf('https://www.exemplo.com/a/b')).toBe('exemplo.com')
    expect(domainOf('https://kubernetes.io/docs')).toBe('kubernetes.io')
  })

  it('devolve null quando não é URL', () => {
    expect(domainOf('nem url é')).toBeNull()
  })
})
