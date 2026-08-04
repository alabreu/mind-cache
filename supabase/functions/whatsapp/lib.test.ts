import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  capturableText,
  extractMessages,
  extractUrl,
  isAllowed,
  parseAllowedNumbers,
  signatureValid,
  timingSafeEqual,
} from './lib'

const SECRET = 'segredo-do-app'

/** Assina como a Meta assina, com uma implementação independente da nossa. */
function sign(raw: string, secret = SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`
}

/** Payload no formato que a Cloud API entrega. */
function webhook(messages: unknown[]): unknown {
  return {
    object: 'whatsapp_business_account',
    entry: [{ id: '123', changes: [{ field: 'messages', value: { messages } }] }],
  }
}

function textMessage(id: string, from: string, body: string) {
  return { id, from, type: 'text', text: { body } }
}

describe('signatureValid', () => {
  it('aceita a assinatura correta', async () => {
    const raw = JSON.stringify(webhook([]))
    expect(await signatureValid(raw, sign(raw), SECRET)).toBe(true)
  })

  it('recusa assinatura de outro segredo', async () => {
    const raw = JSON.stringify(webhook([]))
    expect(await signatureValid(raw, sign(raw, 'outro'), SECRET)).toBe(false)
  })

  it('recusa quando o corpo mudou depois de assinado', async () => {
    const signature = sign('{"a":1}')
    expect(await signatureValid('{"a":2}', signature, SECRET)).toBe(false)
  })

  it('recusa header ausente, vazio ou sem o prefixo sha256=', async () => {
    const raw = '{}'
    expect(await signatureValid(raw, null, SECRET)).toBe(false)
    expect(await signatureValid(raw, '', SECRET)).toBe(false)
    expect(await signatureValid(raw, 'abc123', SECRET)).toBe(false)
  })

  it('recusa quando o segredo não está configurado', async () => {
    // Sem isto, esquecer o secret no deploy abriria o endpoint.
    const raw = '{}'
    expect(await signatureValid(raw, sign(raw), '')).toBe(false)
  })
})

describe('timingSafeEqual', () => {
  it('compara conteúdo', () => {
    expect(timingSafeEqual('abc', 'abc')).toBe(true)
    expect(timingSafeEqual('abc', 'abd')).toBe(false)
  })

  it('trata tamanhos diferentes como diferentes', () => {
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('extractMessages', () => {
  it('lê as mensagens do envelope da Cloud API', () => {
    const payload = webhook([textMessage('wamid.A', '5511999999999', 'oi')])
    expect(extractMessages(payload).map((m) => m.id)).toEqual(['wamid.A'])
  })

  it('ignora entrega de status, que não é captura', () => {
    // O mesmo webhook recebe "entregue/lido"; tratá-los como mensagem encheria
    // o cache de lixo a cada recado enviado.
    const payload = {
      entry: [
        {
          changes: [
            { value: { statuses: [{ id: 'wamid.A', status: 'delivered' }] } },
          ],
        },
      ],
    }
    expect(extractMessages(payload)).toEqual([])
  })

  it('não quebra com payload vazio ou fora do formato', () => {
    expect(extractMessages(null)).toEqual([])
    expect(extractMessages({})).toEqual([])
    expect(extractMessages({ entry: [{}] })).toEqual([])
    expect(extractMessages({ entry: [{ changes: [{}] }] })).toEqual([])
  })

  it('descarta mensagem sem id ou sem remetente', () => {
    const payload = webhook([
      { id: 'wamid.A', type: 'text' },
      { from: '5511999999999', type: 'text' },
      textMessage('wamid.B', '5511999999999', 'ok'),
    ])
    expect(extractMessages(payload).map((m) => m.id)).toEqual(['wamid.B'])
  })

  it('junta mensagens de várias entries', () => {
    const payload = {
      entry: [
        { changes: [{ value: { messages: [textMessage('a', '55', 'x')] } }] },
        { changes: [{ value: { messages: [textMessage('b', '55', 'y')] } }] },
      ],
    }
    expect(extractMessages(payload).map((m) => m.id)).toEqual(['a', 'b'])
  })
})

describe('whitelist', () => {
  it('aceita o número da lista, com ou sem formatação', () => {
    const allowed = parseAllowedNumbers('+55 (11) 99999-9999')
    expect(isAllowed('5511999999999', allowed)).toBe(true)
  })

  it('aceita vários números separados por vírgula', () => {
    const allowed = parseAllowedNumbers('5511999999999, 5521888888888')
    expect(isAllowed('5521888888888', allowed)).toBe(true)
  })

  it('recusa quem não está na lista', () => {
    const allowed = parseAllowedNumbers('5511999999999')
    expect(isAllowed('5511000000000', allowed)).toBe(false)
  })

  it('lista vazia ou ausente bloqueia tudo', () => {
    // Erro de configuração tem que fechar, não abrir.
    expect(isAllowed('5511999999999', parseAllowedNumbers(''))).toBe(false)
    expect(isAllowed('5511999999999', parseAllowedNumbers(undefined))).toBe(
      false,
    )
  })
})

describe('capturableText', () => {
  it('devolve o corpo de uma mensagem de texto', () => {
    expect(capturableText(textMessage('a', '55', ' ideia '))).toBe('ideia')
  })

  it('recusa tipo não suportado (§6: sem upload na v1)', () => {
    expect(capturableText({ id: 'a', from: '55', type: 'image' })).toBeNull()
    expect(capturableText({ id: 'a', from: '55', type: 'audio' })).toBeNull()
  })

  it('recusa texto vazio ou só espaço', () => {
    expect(capturableText(textMessage('a', '55', '   '))).toBeNull()
  })
})

describe('extractUrl', () => {
  // Mesmos casos de src/core/items/url.test.ts — as duas implementações
  // precisam concordar, já que a Edge Function não alcança src/.
  it('extrai a URL do texto', () => {
    expect(extractUrl('ler depois https://kubernetes.io/docs sobre webhook')).toBe(
      'https://kubernetes.io/docs',
    )
  })

  it('corta a pontuação que fecha a frase', () => {
    expect(extractUrl('achei em https://exemplo.com/artigo.')).toBe(
      'https://exemplo.com/artigo',
    )
  })

  it('preserva o parêntese que faz parte da URL', () => {
    expect(extractUrl('https://pt.wikipedia.org/wiki/Cache_(computação)')).toBe(
      'https://pt.wikipedia.org/wiki/Cache_(computação)',
    )
  })

  it('devolve null sem URL', () => {
    expect(extractUrl('só um lembrete')).toBeNull()
    expect(extractUrl('roda em http://localhost:5173')).toBeNull()
  })
})
