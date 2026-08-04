import { describe, expect, it } from 'vitest'
import { highlight, parseTerms } from './highlight'

/** Só os trechos realçados, para o teste falar do que importa. */
function marked(text: string, query: string): string[] {
  return highlight(text, query)
    .filter((segment) => segment.match)
    .map((segment) => segment.text)
}

/** Remontar os pedaços tem que devolver o texto original, sempre. */
function joined(text: string, query: string): string {
  return highlight(text, query)
    .map((segment) => segment.text)
    .join('')
}

describe('parseTerms', () => {
  it('separa palavras soltas', () => {
    expect(parseTerms('cache webhook')).toEqual(['webhook', 'cache'])
  })

  it('trata frase entre aspas como um termo só', () => {
    expect(parseTerms('"fermentação natural" pão')).toEqual([
      'fermentação natural',
      'pão',
    ])
  })

  it('descarta exclusão e operador', () => {
    expect(parseTerms('cache -arquivar')).toEqual(['cache'])
    expect(parseTerms('cache or webhook')).toEqual(['webhook', 'cache'])
  })
})

describe('highlight', () => {
  it('sem busca, devolve o texto inteiro sem marca', () => {
    expect(highlight('um texto', '')).toEqual([{ text: 'um texto', match: false }])
  })

  it('marca o termo onde ele aparece', () => {
    expect(marked('guia de webhook do Kubernetes', 'webhook')).toEqual([
      'webhook',
    ])
  })

  it('ignora caixa', () => {
    expect(marked('Kubernetes Docs', 'kubernetes')).toEqual(['Kubernetes'])
  })

  it('ignora acento nos dois sentidos', () => {
    expect(marked('receita de pão', 'pao')).toEqual(['pão'])
    expect(marked('receita de pao', 'pão')).toEqual(['pao'])
  })

  it('preserva o texto original ao remontar', () => {
    const text = 'ação, coração e pão — três acentos'
    expect(joined(text, 'acao pao')).toBe(text)
  })

  it('marca todas as ocorrências', () => {
    expect(marked('cache é cache', 'cache')).toEqual(['cache', 'cache'])
  })

  it('junta termos sobrepostos num bloco só', () => {
    // "web" e "webhook" se sobrepõem: o realce não pode partir a palavra.
    expect(marked('webhook', 'web webhook')).toEqual(['webhook'])
  })

  it('não realça o que foi excluído da busca', () => {
    expect(marked('cache para arquivar', 'cache -arquivar')).toEqual(['cache'])
  })

  it('não quebra com texto vazio', () => {
    expect(highlight('', 'cache')).toEqual([{ text: '', match: false }])
  })
})
