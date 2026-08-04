import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { Textarea } from '@ui/design'
import { useTranslation } from '@ui/hooks/useTranslation'

/**
 * O campo único de captura (§4.1). Tudo aqui serve a um objetivo: capturar tem
 * que ser mais rápido que abrir o WhatsApp.
 *
 * - foca sozinho ao montar, para dar para digitar sem clicar em nada;
 * - `Enter` envia, `Shift+Enter` quebra linha (o contrário do padrão do
 *   textarea, e é o comportamento que a spec pede);
 * - cresce com o texto, para colar um parágrafo não virar uma fresta de 2
 *   linhas com rolagem interna.
 */
export interface CaptureFieldHandle {
  focus: () => void
  clear: () => void
}

/** Teto de crescimento: passou disso, rola por dentro em vez de empurrar a lista. */
const MAX_HEIGHT_PX = 200

export const CaptureField = forwardRef<
  CaptureFieldHandle,
  { onSubmit: (text: string) => void; disabled?: boolean }
>(function CaptureField({ onSubmit, disabled = false }, ref) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const resize = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_HEIGHT_PX)}px`
  }, [])

  useEffect(() => {
    resize()
  }, [text, resize])

  // §4.1: sempre focado ao abrir o app.
  useEffect(() => {
    if (!disabled) textareaRef.current?.focus()
  }, [disabled])

  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus(),
    clear: () => setText(''),
  }))

  function send() {
    const trimmed = text.trim()
    if (!trimmed) return
    onSubmit(trimmed)
    setText('')
  }

  return (
    <div>
      <label htmlFor="capture" className="sr-only">
        {t('capture.label')}
      </label>
      <Textarea
        id="capture"
        ref={textareaRef}
        rows={1}
        value={text}
        disabled={disabled}
        placeholder={t('capture.placeholder')}
        aria-describedby="capture-hint"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter' || e.shiftKey) return
          // IME: durante a composição (acento, teclado japonês) o Enter é do
          // teclado, não da captura — enviar aqui engoliria a palavra.
          if (e.nativeEvent.isComposing) return
          e.preventDefault()
          send()
        }}
      />
      <p id="capture-hint" className="mt-1 px-1 text-label text-muted">
        {t('capture.hint')}
      </p>
    </div>
  )
})
