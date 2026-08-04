// Busca o <title> de uma página para enriquecer a captura (§4.1).
//
//   supabase functions deploy fetch-title
//
// Por que no servidor e não no browser: o fetch de outra origem esbarra em
// CORS, e quase nenhum site serve os headers que permitiriam ler o HTML.
//
// Isto é um proxy que busca URL escolhida pelo cliente, ou seja, um SSRF com
// convite impresso se ficar aberto. Três travas, nesta ordem:
//   1. exige JWT válido — não é endpoint anônimo;
//   2. recusa host que não seja público (localhost, rede privada, link-local e
//      o endpoint de metadados da nuvem);
//   3. teto de tempo e de bytes, para não virar ferramenta de esgotar recurso.
//
// Falha é SILENCIOSA por especificação: o título é enfeite, o salvamento do
// item não depende dele. Toda saída de erro devolve `{ title: null }` com 200.
import { createClient } from 'jsr:@supabase/supabase-js@2'

declare const Deno: { env: { get(key: string): string | undefined } }

/** §4.1: timeout de 3 segundos. */
const TIMEOUT_MS = 3000
/** O <title> vive no <head>; 256 KB cobrem com folga sem baixar página inteira. */
const MAX_BYTES = 256 * 1024

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') ?? '*'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
}

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })
}

/** Resposta única de fracasso — o cliente não distingue os motivos, e não deve. */
function noTitle(): Response {
  return json(200, { title: null })
}

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata.google.internal',
])

/**
 * Recusa o que não é claramente internet pública.
 *
 * LIMITE CONHECIDO: a checagem é sobre o hostname, então um domínio público que
 * RESOLVE para IP interno passa por aqui (DNS rebinding). Fechar isso de
 * verdade exigiria resolver o nome e prender a conexão àquele IP, o que o
 * runtime não expõe. O que sobra de exposição é uma requisição GET sem
 * credencial cujo corpo nunca volta ao cliente — só o <title> volta —, e é por
 * isso que este endpoint exige JWT em vez de ser anônimo.
 */
function isPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (BLOCKED_HOSTNAMES.has(host)) return false
  if (host.endsWith('.localhost') || host.endsWith('.internal')) return false

  // IPv6: bloqueia loopback (::1), link-local (fe80::) e unique-local (fc00::/7).
  if (host.includes(':')) {
    if (host === '::1' || host === '::') return false
    if (/^fe[89ab]/i.test(host)) return false
    if (/^f[cd]/i.test(host)) return false
    return true
  }

  const v4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) {
    const [a, b] = v4.slice(1).map(Number)
    if (a === 10 || a === 127 || a === 0) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    // 169.254.0.0/16 — inclui 169.254.169.254, o endpoint de metadados.
    if (a === 169 && b === 254) return false
    if (a >= 224) return false
    return true
  }

  // Nome sem ponto não é domínio público ("intranet", "router").
  return host.includes('.')
}

/** Extrai e normaliza o conteúdo de <title>. */
function parseTitle(html: string): string | null {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (!match) return null

  const title = decodeEntities(match[1])
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)

  return title || null
}

function decodeEntities(text: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
  }
  return text
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) =>
      String.fromCodePoint(parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (whole, name) => named[name.toLowerCase()] ?? whole)
}

/** Lê no máximo MAX_BYTES do corpo, sem confiar no Content-Length declarado. */
async function readCapped(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''

  const chunks: Uint8Array[] = []
  let total = 0
  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done || !value) break
      chunks.push(value)
      total += value.length
      if (total >= MAX_BYTES) break
    }
  } finally {
    await reader.cancel().catch(() => {})
  }

  const buffer = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    buffer.set(chunk.subarray(0, Math.min(chunk.length, total - offset)), offset)
    offset += chunk.length
    if (offset >= total) break
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' })

  // 1. Sessão válida. Sem isto o endpoint é um buscador de URL aberto ao mundo.
  const jwt = (req.headers.get('Authorization') ?? '').replace(
    /^Bearer\s+/i,
    '',
  )
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  if (!jwt || !supabaseUrl || !anonKey) return json(401, { error: 'unauthorized' })

  const auth = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  })
  const { data: userData } = await auth.auth.getUser()
  if (!userData?.user) return json(401, { error: 'unauthorized' })

  // 2. URL utilizável e pública.
  let target: URL
  try {
    const body = (await req.json()) as { url?: unknown }
    if (typeof body.url !== 'string' || body.url.length > 2000) return noTitle()
    target = new URL(body.url)
  } catch {
    return noTitle()
  }
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return noTitle()
  }
  if (!isPublicHost(target.hostname)) return noTitle()

  // 3. Busca com teto de tempo e de bytes.
  const abort = new AbortController()
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(target.toString(), {
      signal: abort.signal,
      redirect: 'follow',
      headers: {
        // Alguns sites devolvem 403 para user agent vazio.
        'user-agent': 'Mozilla/5.0 (compatible; MindCache/1.0)',
        accept: 'text/html,application/xhtml+xml',
      },
    })

    if (!response.ok) return noTitle()

    const contentType = response.headers.get('content-type') ?? ''
    // Só HTML: baixar PDF ou vídeo aqui seria desperdício e não tem <title>.
    if (!contentType.includes('html')) return noTitle()

    return json(200, { title: parseTitle(await readCapped(response)) })
  } catch {
    // Timeout, DNS, TLS, redirect infinito — tudo cai aqui, tudo é silencioso.
    return noTitle()
  } finally {
    clearTimeout(timer)
  }
})
