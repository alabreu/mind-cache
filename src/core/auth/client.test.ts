import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * O que este teste protege: a leitura de "o cadastro abriu sessão?".
 *
 * Era exatamente aqui que estava o bug — `signUp` devolvia `void`, a UI assumia
 * que tinha logado e mandava o usuário para uma tela que o tratava como
 * deslogado. Com a confirmação de e-mail ligada (o padrão do Supabase), o
 * cadastro simplesmente não parecia fazer nada.
 */
const signUpMock = vi.fn()

vi.mock('@core/backend/client', () => ({
  backendConfigured: true,
  backendUrl: 'https://exemplo.supabase.co',
  backendAnonKey: 'anon',
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
    },
  },
}))

const { authClient } = await import('./client')

beforeEach(() => {
  signUpMock.mockReset()
})

describe('signUp', () => {
  it('pede confirmação quando o cadastro não abriu sessão', async () => {
    signUpMock.mockResolvedValue({
      data: { user: { id: 'u1' }, session: null },
      error: null,
    })

    await expect(authClient.signUp('eu@exemplo.com', 'senha')).resolves.toEqual({
      needsEmailConfirmation: true,
    })
  })

  it('não pede confirmação quando já veio sessão', async () => {
    // É o caso com "Confirm email" desligado: dá para entrar direto.
    signUpMock.mockResolvedValue({
      data: { user: { id: 'u1' }, session: { access_token: 't' } },
      error: null,
    })

    await expect(authClient.signUp('eu@exemplo.com', 'senha')).resolves.toEqual({
      needsEmailConfirmation: false,
    })
  })

  it('trata e-mail já cadastrado como qualquer outro cadastro', async () => {
    // Com a confirmação ligada, o Supabase devolve uma resposta indistinguível
    // de propósito, para o formulário não virar um verificador de quais e-mails
    // têm conta. Se algum dia isto passar a diferenciar, é regressão de
    // privacidade, não melhoria de UX.
    signUpMock.mockResolvedValue({
      data: { user: { id: '00000000-0000-0000-0000-000000000000' }, session: null },
      error: null,
    })

    await expect(authClient.signUp('ja@existe.com', 'senha')).resolves.toEqual({
      needsEmailConfirmation: true,
    })
  })

  it('propaga erro do provedor em vez de engolir', async () => {
    signUpMock.mockResolvedValue({
      data: { user: null, session: null },
      error: new Error('senha fraca'),
    })

    await expect(authClient.signUp('eu@exemplo.com', '123')).rejects.toThrow(
      'senha fraca',
    )
  })
})
