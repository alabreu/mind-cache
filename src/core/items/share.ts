/**
 * Captura externa (§4.4): o que chega de fora do app vira texto de captura.
 *
 * Duas portas, e as duas caem aqui:
 *   - `share_target` do sistema — o service worker recebe o POST e deixa o
 *     payload no Cache API (ver src/sw.ts);
 *   - bookmarklet e link direto — chegam como `?text=`/`?url=`/`?title=`.
 *
 * A leitura é em duas etapas (`readSharedDraft` / `clearSharedDraft`) de
 * propósito: quem chega deslogado não pode perder o que compartilhou. O
 * rascunho fica guardado até haver sessão para salvá-lo.
 */

/** Precisa bater com o SW — é o contrato entre os dois lados. */
const SHARE_CACHE = 'mind-cache-share'
const SHARE_KEY = '/__shared-payload'

interface SharePayload {
  title: string
  text: string
  url: string
}

/**
 * Junta título, texto e URL num texto de captura só, sem repetir o que já está
 * lá. Compartilhar uma página costuma mandar título E url — e às vezes o texto
 * já contém os dois.
 */
export function composeDraft({ title, text, url }: SharePayload): string {
  const parts: string[] = []
  for (const part of [text, title, url]) {
    const value = part.trim()
    if (!value) continue
    if (parts.some((existing) => existing.includes(value))) continue
    parts.push(value)
  }
  // URL por último: é o que a detecção de URL vai extrair, e no fim ela não
  // atrapalha a leitura das primeiras linhas na lista.
  return parts.sort((a, b) => Number(isUrl(a)) - Number(isUrl(b))).join('\n')
}

function isUrl(value: string): boolean {
  return /^https?:\/\/\S+$/i.test(value)
}

/** Rascunho vindo da URL (bookmarklet), se houver. */
function fromQuery(search: string): string | null {
  const params = new URLSearchParams(search)
  const draft = composeDraft({
    title: params.get('title') ?? '',
    text: params.get('text') ?? '',
    url: params.get('url') ?? '',
  })
  return draft || null
}

/** Rascunho deixado pelo service worker, se houver. */
async function fromCache(): Promise<string | null> {
  if (typeof caches === 'undefined') return null
  try {
    const cache = await caches.open(SHARE_CACHE)
    const stored = await cache.match(SHARE_KEY)
    if (!stored) return null
    const payload = (await stored.json()) as Partial<SharePayload>
    const draft = composeDraft({
      title: payload.title ?? '',
      text: payload.text ?? '',
      url: payload.url ?? '',
    })
    return draft || null
  } catch {
    return null
  }
}

/**
 * O que está pendente para capturar, sem consumir. Chamar de novo devolve o
 * mesmo — só `clearSharedDraft` descarta.
 */
export async function readSharedDraft(search: string): Promise<string | null> {
  return fromQuery(search) ?? (await fromCache())
}

/** Descarta o rascunho pendente. Chamar DEPOIS de a captura ter sido aceita. */
export async function clearSharedDraft(): Promise<void> {
  if (typeof caches === 'undefined') return
  try {
    const cache = await caches.open(SHARE_CACHE)
    await cache.delete(SHARE_KEY)
  } catch {
    // Cache indisponível (modo privado): o rascunho da URL some no replaceState.
  }
}

/**
 * Bookmarklet da §4.4, pronto para arrastar até a barra de favoritos. Gerado a
 * partir da origin real para funcionar igual em produção e em localhost.
 *
 * Manda seleção (quando há), título e URL. `encodeURIComponent` em tudo: sem
 * isso, um `&` no título cortaria o resto dos parâmetros.
 */
export function buildBookmarklet(origin: string): string {
  return (
    `javascript:(function(){` +
    `var s=String(getSelection()||'');` +
    `var q='text='+encodeURIComponent(s)` +
    `+'&title='+encodeURIComponent(document.title)` +
    `+'&url='+encodeURIComponent(location.href);` +
    `window.open('${origin}/?'+q,'_blank','noopener');` +
    `})()`
  )
}
