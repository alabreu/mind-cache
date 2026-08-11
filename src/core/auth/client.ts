import type { User } from '@supabase/supabase-js'
import { backendConfigured, supabase } from '@core/backend/client'
import type { AuthUser } from '@core/domain/user'

/**
 * Camada de auth sobre o backend. Opcional: o app é totalmente usável como
 * convidado, então tudo degrada graciosamente sem as chaves
 * (`configured=false`). O provedor fica atrás deste wrapper fino — a UI só
 * enxerga `AuthUser`.
 */
function toUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null
  const meta = user.user_metadata ?? {}
  return {
    id: user.id,
    email: user.email ?? undefined,
    name: (meta.full_name as string) || (meta.name as string) || undefined,
    avatarUrl:
      (meta.avatar_url as string) || (meta.picture as string) || undefined,
  }
}

export interface SignUpResult {
  /**
   * `true` quando o cadastro não abriu sessão porque falta confirmar o e-mail.
   * Quem chama precisa mostrar "confira sua caixa de entrada" em vez de seguir
   * como se tivesse logado.
   */
  needsEmailConfirmation: boolean
}

export const authClient = {
  /** Se as chaves do backend estão presentes (login disponível). */
  configured: backendConfigured,

  async currentUser(): Promise<AuthUser | null> {
    if (!supabase) return null
    const { data } = await supabase.auth.getSession()
    return toUser(data.session?.user)
  },

  /** Assina sign-in/out; retorna a função de unsubscribe. */
  onChange(cb: (user: AuthUser | null) => void): () => void {
    if (!supabase) return () => {}
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      cb(toUser(session?.user)),
    )
    return () => data.subscription.unsubscribe()
  },

  /**
   * Cria a conta. O retorno importa: com "Confirm email" ligado no Supabase o
   * cadastro NÃO abre sessão — o usuário precisa clicar no link antes. Sem
   * saber disso, a UI acha que logou e manda o usuário para uma tela que vai
   * tratá-lo como deslogado.
   *
   * Não dá (nem se deve) distinguir "conta criada" de "e-mail já cadastrado":
   * com a confirmação ligada o Supabase devolve a mesma resposta para os dois
   * casos, de propósito, para o formulário não virar um verificador de quais
   * e-mails têm conta. A UI diz a mesma coisa nos dois casos.
   */
  async signUp(email: string, password: string): Promise<SignUpResult> {
    if (!supabase) throw new Error('auth-not-configured')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return { needsEmailConfirmation: !data.session }
  },

  async signIn(email: string, password: string): Promise<void> {
    if (!supabase) throw new Error('auth-not-configured')
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  },

  /** Fluxo OAuth por redirect; `redirectTo` é a origin do app (fornecida pela UI). */
  async signInWithGoogle(redirectTo: string): Promise<void> {
    if (!supabase) throw new Error('auth-not-configured')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) throw error
  },

  async signOut(): Promise<void> {
    if (!supabase) return
    await supabase.auth.signOut()
  },
}
