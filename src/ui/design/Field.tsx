import { useId } from 'react'
import type { ComponentPropsWithRef, ReactNode } from 'react'

/**
 * Campos de formulário. `Field` existe para tornar o rótulo o caminho de menor
 * resistência: ele gera o id e faz o `htmlFor`, então ninguém precisa lembrar de
 * amarrar os dois na mão (rótulo solto é a falha de acessibilidade mais comum em
 * formulário).
 *
 * `text-input` (16px) e não `text-body` (14px): abaixo de 16px o Safari do iOS
 * dá zoom sozinho ao focar o campo, e o jeito de impedir isso sem tirar o zoom
 * de quem precisa dele é o campo subir de tamanho. Ver o token em index.css.
 */
const CONTROL =
  'w-full rounded-field bg-ink/5 px-4 py-3 text-input text-ink outline-none ring-1 ring-ink/10 placeholder:text-muted focus:ring-2 focus:ring-primary/40'

// `ComponentPropsWithRef` (e não `…HTMLAttributes`) para o `ref` passar direto:
// no React 19 ele é prop normal de componente de função, e quem precisa focar o
// campo por atalho de teclado depende disso.
export function Input({
  className = '',
  ...rest
}: ComponentPropsWithRef<'input'>) {
  return <input className={`${CONTROL} ${className}`} {...rest} />
}

export function Textarea({
  className = '',
  ...rest
}: ComponentPropsWithRef<'textarea'>) {
  return <textarea className={`${CONTROL} resize-none ${className}`} {...rest} />
}

export interface FieldProps {
  label: string
  /** Recebe o id gerado — passe para o controle. */
  children: (id: string) => ReactNode
  className?: string
}

export function Field({ label, children, className = '' }: FieldProps) {
  const id = useId()
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-2 block text-label font-semibold uppercase tracking-wide text-muted"
      >
        {label}
      </label>
      {children(id)}
    </div>
  )
}
