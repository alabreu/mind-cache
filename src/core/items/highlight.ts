/**
 * Realce dos termos buscados (§4.3). Função pura que devolve pedaços marcados —
 * quem renderiza decide como destacar, e nada aqui monta HTML (montar string de
 * HTML com texto do usuário seria um XSS esperando acontecer).
 */

export interface Segment {
  text: string
  match: boolean
}

/**
 * Compara sem acento e sem caixa, mas preservando o COMPRIMENTO: cada caractere
 * vira exatamente um caractere. Um `normalize('NFD')` solto separaria o acento
 * em dois code points e desalinharia os índices do texto original, fazendo o
 * realce cair no lugar errado.
 */
function fold(text: string): string {
  let folded = ''
  for (const char of text.toLowerCase()) {
    const stripped = char.normalize('NFD').replace(/\p{M}/gu, '')
    folded += stripped.length === 1 ? stripped : char
  }
  return folded
}

/**
 * Termos que valem realce, na mesma leitura que o `websearch_to_tsquery` faz da
 * caixa de busca: aspas viram frase única e `-termo` é exclusão — realçar o que
 * foi explicitamente excluído seria mentir sobre por que o item apareceu.
 */
export function parseTerms(query: string): string[] {
  const terms: string[] = []
  const phrases = /"([^"]*)"/g

  let rest = query
  for (const match of query.matchAll(phrases)) {
    const phrase = match[1].trim()
    if (phrase) terms.push(phrase)
    rest = rest.replace(match[0], ' ')
  }

  for (const word of rest.split(/\s+/)) {
    const clean = word.trim()
    if (!clean || clean.startsWith('-')) continue
    // `or` é operador do websearch, não termo de busca.
    if (/^(or|ou)$/i.test(clean)) continue
    terms.push(clean)
  }

  // Do maior para o menor: com "cache" e "cach" na mesma busca, casar o maior
  // primeiro evita partir o realce no meio da palavra.
  return terms.sort((a, b) => b.length - a.length)
}

export function highlight(text: string, query: string): Segment[] {
  const terms = parseTerms(query)
  if (!text || terms.length === 0) return [{ text, match: false }]

  const haystack = fold(text)
  const needles = terms.map(fold).filter(Boolean)

  // Marca cada posição casada; sobrepor termos vira um bloco só.
  const marked = new Array<boolean>(text.length).fill(false)
  for (const needle of needles) {
    let from = 0
    for (;;) {
      const at = haystack.indexOf(needle, from)
      if (at === -1) break
      for (let i = at; i < at + needle.length; i += 1) marked[i] = true
      from = at + needle.length
    }
  }

  const segments: Segment[] = []
  let start = 0
  for (let i = 1; i <= text.length; i += 1) {
    if (i < text.length && marked[i] === marked[start]) continue
    segments.push({ text: text.slice(start, i), match: marked[start] })
    start = i
  }
  return segments.length > 0 ? segments : [{ text, match: false }]
}
