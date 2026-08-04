/**
 * Lógica pura do webhook do WhatsApp, separada do `index.ts` para poder ser
 * testada. Nada aqui toca em `Deno`, em rede ou em banco — só WebCrypto e JS
 * padrão, que existem igual no Deno e no runtime dos testes.
 *
 * É a parte que não pode estar errada: assinatura, whitelist e o que conta como
 * mensagem. Um erro em qualquer uma delas ou deixa entrar quem não devia, ou
 * descarta captura em silêncio.
 */

export interface IncomingMessage {
  id: string
  from: string
  type: string
  text?: { body?: string }
}

/** Comparação de tempo constante: `a === b` vaza o prefixo correto pelo relógio. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

/**
 * Confere o `X-Hub-Signature-256` sobre o corpo CRU. Tem que ser o corpo cru:
 * reserializar o JSON muda espaço e ordem de chave, e o HMAC deixa de bater.
 */
export async function signatureValid(
  raw: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!secret || !header?.startsWith('sha256=')) return false

  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(raw))
  const expected = [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

  return timingSafeEqual(expected, header.slice('sha256='.length))
}

/**
 * Só as mensagens de verdade. O mesmo webhook entrega `statuses`
 * (entregue/lido/falhou), que não é captura — tratá-los como mensagem encheria
 * o cache de lixo a cada recado enviado.
 */
export function extractMessages(payload: unknown): IncomingMessage[] {
  const entries =
    (payload as { entry?: { changes?: { value?: unknown }[] }[] } | null)
      ?.entry ?? []
  const messages: IncomingMessage[] = []

  for (const entry of entries) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value as { messages?: IncomingMessage[] } | undefined
      for (const message of value?.messages ?? []) {
        if (message?.id && message?.from) messages.push(message)
      }
    }
  }
  return messages
}

/**
 * Whitelist da §5.2. Guarda só os dígitos: o número chega da Meta sem formatação
 * mas o secret é digitado à mão, e um `+55 11…` colado do contato não pode
 * silenciosamente deixar de casar.
 */
export function parseAllowedNumbers(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((number) => number.trim().replace(/\D/g, ''))
      .filter(Boolean),
  )
}

export function isAllowed(from: string, allowed: Set<string>): boolean {
  // Whitelist vazia bloqueia tudo. O contrário — secret ausente liberando geral
  // — transformaria um erro de configuração num insert aberto.
  if (allowed.size === 0) return false
  return allowed.has(from.replace(/\D/g, ''))
}

/**
 * Mesma detecção do app (src/core/items/url.ts), reescrita aqui porque a Edge
 * Function roda em Deno, fora do bundle do Vite, e não alcança `src/`. Ao mexer
 * numa, mexa na outra — os testes das duas cobrem os mesmos casos.
 */
export function extractUrl(text: string): string | null {
  const matches = text.match(/https?:\/\/[^\s<>"']+/gi)
  if (!matches?.length) return null

  for (const raw of matches) {
    let url = raw
    for (;;) {
      if (!/[.,;:!?)\]}>"'»]$/.test(url)) break
      const last = url[url.length - 1]
      const opener = last === ')' ? '(' : last === ']' ? '[' : null
      if (opener) {
        const opens = url.split(opener).length - 1
        const closes = url.split(last).length - 1
        if (opens >= closes) break
      }
      url = url.slice(0, -1)
      if (!url) break
    }
    try {
      if (new URL(url).hostname.includes('.')) return url
    } catch {
      // Segue para a próxima candidata.
    }
  }
  return null
}

/** O texto capturável de uma mensagem, ou null quando o tipo não é suportado. */
export function capturableText(message: IncomingMessage): string | null {
  if (message.type !== 'text') return null
  const text = (message.text?.body ?? '').trim()
  return text || null
}
