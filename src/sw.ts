/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'

/**
 * Service worker do Mind Cache.
 *
 * Existe custom (modo `injectManifest`) por um motivo só: o `share_target` da
 * §4.4 usa POST com multipart/form-data, e um SPA estático não tem como receber
 * um POST — quem intercepta é o SW. Todo o resto (precache, limpeza de cache
 * velho, prompt de atualização) segue igual ao que o `generateSW` do boilerplate
 * já fazia.
 *
 * O payload compartilhado NÃO viaja na URL: texto compartilhado passa fácil dos
 * ~2000 caracteres que a barra de endereço aguenta, e truncar aqui seria perder
 * captura em silêncio. Ele fica no Cache API, que o SW escreve e a página lê.
 */
declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: { url: string; revision: string | null }[]
}

export const SHARE_CACHE = 'mind-cache-share'
export const SHARE_KEY = '/__shared-payload'
const SHARE_PATH = '/share'

// Registrado ANTES do precache: quem não chamar `respondWith` deixa o próximo
// listener assumir, então o roteamento normal do Workbox continua valendo.
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'POST') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname !== SHARE_PATH) return

  event.respondWith(
    (async () => {
      try {
        const form = await request.formData()
        const payload = {
          title: asText(form.get('title')),
          text: asText(form.get('text')),
          url: asText(form.get('url')),
        }
        const cache = await caches.open(SHARE_CACHE)
        await cache.put(
          SHARE_KEY,
          new Response(JSON.stringify(payload), {
            headers: { 'content-type': 'application/json' },
          }),
        )
      } catch {
        // Compartilhamento malformado: cai na home sem nada pendente, em vez de
        // devolver um erro numa aba que o usuário não pediu para abrir.
      }
      // 303 para o navegador trocar o POST por um GET na home — sem isso, um
      // reload reenviaria o compartilhamento.
      return Response.redirect('/', 303)
    })(),
  )
})

function asText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

self.addEventListener('message', (event) => {
  // O modo `prompt` do vite-plugin-pwa: o SW novo só assume quando o usuário
  // aceita o toast de atualização.
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()
clientsClaim()
