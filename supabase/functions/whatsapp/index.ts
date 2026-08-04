// Webhook do WhatsApp (§5). O WhatsApp é um canal de coleta BURRO: recebe,
// valida, insere, confirma. Não conversa, não interpreta e — regra da §5.2 e da
// v1.5 — nunca chama LLM. O enriquecimento, quando existir, roda depois, sem
// saber de onde o item veio.
//
// Cloud API OFICIAL da Meta. Nunca whatsapp-web.js, Baileys ou qualquer
// automação do WhatsApp Web: violam os termos de uso e arriscam o banimento do
// número (§5.2).
//
// A lógica que não pode estar errada (assinatura, whitelist, o que conta como
// mensagem) mora em ./lib.ts, que tem testes. Aqui fica só o que depende de
// rede, banco e do runtime.
//
// Deploy e segredos (nenhum destes é VITE_*, nenhum entra no bundle):
//
//   supabase functions deploy whatsapp --no-verify-jwt
//   supabase secrets set WHATSAPP_VERIFY_TOKEN=...
//   supabase secrets set WHATSAPP_ACCESS_TOKEN=...
//   supabase secrets set WHATSAPP_PHONE_NUMBER_ID=...
//   supabase secrets set WHATSAPP_APP_SECRET=...
//   supabase secrets set WHATSAPP_ALLOWED_NUMBERS=5511999999999
//   supabase secrets set MIND_CACHE_OWNER_ID=<uuid do usuário dono do cache>
//
// `--no-verify-jwt` é obrigatório: quem chama é a Meta, que não tem sessão do
// Supabase. Quem faz o papel da autenticação aqui é a assinatura HMAC.
//
// MIND_CACHE_OWNER_ID não está na lista da §5.4 mas é necessário: `items.user_id`
// é NOT NULL e o webhook não tem sessão de onde tirar o dono. Como o app é
// single-user (§1), o dono é fixo e vem de secret.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  capturableText,
  extractMessages,
  extractUrl,
  isAllowed,
  parseAllowedNumbers,
  signatureValid,
  timingSafeEqual,
} from './lib.ts'

declare const Deno: { env: { get(key: string): string | undefined } }
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const GRAPH_VERSION = 'v21.0'

/**
 * §5.3: reage na mensagem original. Só é chamada DEPOIS de o insert responder —
 * um ✅ mentindo é pior que ausência de sinal, porque ninguém volta para
 * conferir (§5.2).
 */
async function react(to: string, messageId: string, emoji: string) {
  const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') ?? ''
  const token = Deno.env.get('WHATSAPP_ACCESS_TOKEN') ?? ''
  if (!phoneNumberId || !token) return

  try {
    await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to,
          type: 'reaction',
          reaction: { message_id: messageId, emoji },
        }),
      },
    )
  } catch {
    // A reação é o aviso, não o dado. Se ela falhar, o item já está salvo — e
    // derrubar o processamento aqui não melhoraria nada.
  }
}

async function process(payload: unknown): Promise<void> {
  const messages = extractMessages(payload)
  if (messages.length === 0) return

  const ownerId = Deno.env.get('MIND_CACHE_OWNER_ID') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  // service_role porque não há sessão: quem escreve é o servidor, em nome do
  // dono. A chave é secret da function e nunca sai daqui.
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  if (!ownerId || !supabaseUrl || !serviceKey) return

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })
  const allowed = parseAllowedNumbers(Deno.env.get('WHATSAPP_ALLOWED_NUMBERS'))

  for (const message of messages) {
    // Whitelist (§5.2). Número fora dela é ignorado em SILÊNCIO — reagir
    // confirmaria para um desconhecido que este número roda um bot.
    if (!isAllowed(message.from, allowed)) continue

    const text = capturableText(message)
    if (!text) {
      // Foto, áudio, documento: fora do escopo da v1 (§6, sem upload). O
      // usuário mandou esperando guardar, então o silêncio seria ambíguo — ❌
      // diz "não entrou" sem prometer que um dia entra.
      await react(message.from, message.id, '❌')
      continue
    }

    const { error } = await supabase.from('items').insert({
      user_id: ownerId,
      raw_text: text.slice(0, 20000),
      url: extractUrl(text),
      source: 'whatsapp',
      external_id: message.id,
    })

    // 23505 = índice único parcial (source, external_id): a Meta reenviou algo
    // que já entrou. Não é falha — é a idempotência funcionando. Reage ✅ de
    // novo porque a reação da primeira tentativa pode ter sido a que falhou, e
    // reaplicar a mesma reação é no-op do lado da Meta.
    const duplicated = (error as { code?: string } | null)?.code === '23505'
    await react(message.from, message.id, !error || duplicated ? '✅' : '❌')
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)

  // Handshake de verificação do webhook (a Meta faz um GET ao configurar).
  if (req.method === 'GET') {
    const token = Deno.env.get('WHATSAPP_VERIFY_TOKEN') ?? ''
    const mode = url.searchParams.get('hub.mode')
    const sent = url.searchParams.get('hub.verify_token')
    const challenge = url.searchParams.get('hub.challenge') ?? ''

    if (mode === 'subscribe' && token && timingSafeEqual(token, sent ?? '')) {
      return new Response(challenge, { status: 200 })
    }
    return new Response('forbidden', { status: 403 })
  }

  if (req.method !== 'POST') {
    return new Response('method not allowed', { status: 405 })
  }

  const secret = Deno.env.get('WHATSAPP_APP_SECRET') ?? ''
  const raw = await req.text()

  // A assinatura é conferida ANTES do 200. A §5.1 desenha o 200 primeiro, mas
  // aquilo é sobre não segurar a Meta durante o trabalho de banco: o HMAC é
  // cópia de bytes, sem I/O, e devolver 200 para requisição não assinada
  // transformaria este endpoint num insert aberto para quem descobrisse a URL.
  const signature = req.headers.get('x-hub-signature-256')
  if (!(await signatureValid(raw, signature, secret))) {
    return new Response('invalid signature', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(raw)
  } catch {
    return new Response('bad request', { status: 400 })
  }

  // §5.2: 200 IMEDIATAMENTE, e o trabalho continua depois da resposta. A Meta
  // reenvia a entrega se demorarmos — e reenvio custa caro sem a idempotência
  // do índice único, que é justamente o que sustenta esta escolha.
  EdgeRuntime.waitUntil(process(payload))
  return new Response('ok', { status: 200 })
})
