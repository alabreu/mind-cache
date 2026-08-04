import {
  backendAnonKey,
  backendConfigured,
  backendUrl,
  supabase,
} from '@core/backend/client'

/**
 * Título da página apontada pela URL capturada (§4.1), buscado pela Edge
 * Function `fetch-title` — do browser não daria: CORS bloqueia ler o HTML de
 * outra origem.
 *
 * Contrato desta função: NUNCA lança e NUNCA demora. Falha é silenciosa por
 * especificação — o título é enfeite, e travar o salvamento por causa dele
 * violaria o princípio de "capturar tem que ser mais rápido que abrir o
 * WhatsApp". Quem chama trata `null` como "sem título" e segue.
 */
const PATH = '/functions/v1/fetch-title'

/**
 * Teto do lado do cliente. A function já corta em 3s (§4.1); este é a rede de
 * segurança para o caso de a própria function não responder — sem ele, um
 * cold start poderia segurar o enriquecimento por bem mais que isso.
 */
const CLIENT_TIMEOUT_MS = 5000

export async function fetchTitle(
  url: string,
  signal?: AbortSignal,
): Promise<string | null> {
  if (!backendConfigured || !supabase) return null

  const timeout = new AbortController()
  const timer = setTimeout(() => timeout.abort(), CLIENT_TIMEOUT_MS)
  const onAbort = () => timeout.abort()
  signal?.addEventListener('abort', onAbort)

  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return null

    const response = await fetch(`${backendUrl}${PATH}`, {
      method: 'POST',
      signal: timeout.signal,
      headers: {
        'content-type': 'application/json',
        apikey: backendAnonKey,
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ url }),
    })

    if (!response.ok) return null
    const body = (await response.json()) as { title?: unknown }
    return typeof body.title === 'string' && body.title ? body.title : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}
