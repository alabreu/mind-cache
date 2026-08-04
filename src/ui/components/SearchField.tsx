import { useImperativeHandle, useRef, type Ref } from 'react'
import { MagnifyingGlass, X } from '@phosphor-icons/react'
import { IconButton, Input } from '@ui/design'
import { useTranslation } from '@ui/hooks/useTranslation'

/**
 * Caixa de busca do topo (§4.3). O debounce NÃO está aqui: quem debounça é o
 * `useItems`, porque é ele que decide quando ir ao servidor. Aqui o input é
 * controlado e responde a cada tecla, que é o que faz a digitação parecer
 * instantânea mesmo com a consulta atrasada.
 */
export interface SearchFieldHandle {
  focus: () => void
}

export interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  ref?: Ref<SearchFieldHandle>
}

export function SearchField({ value, onChange, ref }: SearchFieldProps) {
  const { t } = useTranslation()
  const inputRef = useRef<HTMLInputElement>(null)

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
  }))

  return (
    <div className="relative">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted"
      >
        <MagnifyingGlass size={16} weight="bold" />
      </span>
      <label htmlFor="search" className="sr-only">
        {t('search.label')}
      </label>
      <Input
        id="search"
        ref={inputRef}
        type="search"
        value={value}
        autoComplete="off"
        placeholder={t('search.placeholder')}
        className="pl-9 pr-10"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          // Esc limpa a busca sem tirar o foco — dá para emendar outra.
          if (e.key === 'Escape' && value) {
            e.preventDefault()
            e.stopPropagation()
            onChange('')
          }
        }}
      />
      {value && (
        <span className="absolute inset-y-0 right-1 flex items-center">
          <IconButton aria-label={t('search.clear')} onClick={() => onChange('')}>
            <X size={16} weight="bold" />
          </IconButton>
        </span>
      )}
    </div>
  )
}
