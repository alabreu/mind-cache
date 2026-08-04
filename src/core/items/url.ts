/**
 * Detecção de URL no texto capturado (§4.1). Funções puras: a captura cola
 * qualquer coisa e a gente extrai o que der, sem nunca bloquear o salvamento.
 */

// Só http(s). `www.algo.com` sem esquema fica de fora de propósito: sem
// esquema não dá para distinguir domínio de frase com ponto ("vou ali.volto
// já"), e um falso positivo aqui polui a coluna `url` de um item que é texto.
const URL_RE = /https?:\/\/[^\s<>"']+/gi

// Pontuação que costuma vir GRUDADA na URL quando ela fecha uma frase ou vem
// dentro de parêntese/aspas. Cortada do fim, nunca do meio.
const TRAILING = /[.,;:!?)\]}>"'»]+$/

/**
 * Primeira URL do texto, ou null. Quando há mais de uma, vence a primeira:
 * numa captura com link + comentário, o link costuma vir antes.
 */
export function extractUrl(text: string): string | null {
  const matches = text.match(URL_RE)
  if (!matches?.length) return null

  for (const raw of matches) {
    const cleaned = trimTrailingPunctuation(raw)
    if (isValid(cleaned)) return cleaned
  }
  return null
}

/**
 * Domínio para exibir na lista (§4.2), sem `www.`. Null quando não é URL
 * válida — a lista simplesmente não mostra a linha do domínio nesse caso.
 */
export function domainOf(url: string): string | null {
  try {
    const host = new URL(url).hostname
    return host.replace(/^www\./i, '') || null
  } catch {
    return null
  }
}

/**
 * Fecha parêntese/colchete só quando ele abriu dentro da própria URL — é o caso
 * do Wikipédia (`.../Cache_(computing)`), em que cortar o `)` quebra o link.
 */
function trimTrailingPunctuation(raw: string): string {
  let url = raw
  for (;;) {
    const match = url.match(TRAILING)
    if (!match) return url

    const last = url[url.length - 1]
    const opener = last === ')' ? '(' : last === ']' ? '[' : null
    if (opener) {
      const opens = url.split(opener).length - 1
      const closes = url.split(last).length - 1
      if (opens >= closes) return url
    }

    url = url.slice(0, -1)
    if (!url) return url
  }
}

function isValid(url: string): boolean {
  try {
    const parsed = new URL(url)
    // Exige host com ponto: "http://localhost" é URL válida mas não é o que
    // alguém captura para reler depois.
    return parsed.hostname.includes('.')
  } catch {
    return false
  }
}
