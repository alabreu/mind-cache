# mind-cache

Web app pessoal (single-user) para capturar informações soltas — links, ideias,
trechos de texto — e recuperá-las depois via busca. O princípio central:
**capturar tem que ser mais rápido do que abrir o WhatsApp**. Organização
acontece depois, automaticamente, ou nunca. É um *cache*, não um arquivo.

Escopo completo em `docs/SPEC.md`. Histórico de como o projeto começou em
`docs/HANDOFF.md`.

## Onde a spec foi superada

`docs/SPEC.md` foi escrito **antes** do `app-boilerplate` existir na forma
atual. O boilerplate é a **referência técnica principal**; onde os dois
conflitam, vale o que está aqui:

| Ponto | A spec pede | Vale isto | Por quê |
| --- | --- | --- | --- |
| Stack (§2) | Next.js + App Router | **React + Vite**, do boilerplate | A §0 já mandava tratar a stack do template como fonte de verdade |
| Backend server-side (§4.1, §5) | Route handlers do Next | **Supabase Edge Functions** | O boilerplate já traz o padrão em `supabase/functions/llm` — sem fornecedor novo |
| Auth (§4.5) | Magic link e nada além | **E-mail+senha e Google**, como o boilerplate entrega | Decisão do dono: não mutilar o core por causa de um app |
| Tema (§6) | Escolher um, sem toggle | **Acompanha o sistema** (sem `data-theme` fixo) | O boilerplate confere contraste AA nos dois temas no `npm run lint` |

## Schema — tabela `items`

Migração `supabase/migrations/0004_items.sql`. Pontos que não são óbvios:

- `to_tsvector('portuguese', …)` faz stemming ruim em termo técnico em inglês;
  o índice trigram compensa (busca parcial e erro de digitação caem nele).
- O índice **único parcial** em `(source, external_id)` é essencial: a Meta
  reenvia webhook em caso de falha e sem ele os itens duplicam.
- `last_accessed_at` não é usado na v1. Existe desde já porque a v3 depende
  dela e adicionar coluna depois é mais caro.

## Fora de escopo na v1

Não implemente, não sugira, **não deixe stub**:

- Qualquer chamada de LLM (o `core/llm` do boilerplate fica sem uso aqui)
- Embeddings, busca semântica, RAG
- Categorização ou resumo automático
- Upload de imagem ou arquivo
- Modo offline / fila de sincronização
- Toggle de tema na UI
- Multi-usuário, compartilhamento, colaboração
- App nativo ou wrapper

A §9 da spec (roadmap pós-v1) existe só para não fechar portas. Nada dela entra
agora.

## Regras próprias do Mind Cache

- **Webhook do WhatsApp (§5.2), inegociável:** usar a Cloud API oficial da
  Meta — nunca `whatsapp-web.js`, Baileys ou qualquer automação do WhatsApp
  Web. Responder 200 **antes** de processar. Reagir ✅ só depois de o insert
  confirmar, ❌ se falhar — silêncio é ambíguo demais.
- **Design (§7):** referência é terminal ou cliente de e-mail, não app de notas.
  Denso e rápido, fonte pequena, alto contraste, transição curta ou nenhuma.
  Atalhos: `/` foca a busca, `n` foca a captura, `Esc` limpa. Priorizar
  estrutura e comportamento — o dono dirige o visual.

---

# Referência técnica (vinda do app-boilerplate)

Detalhes de uso e setup: `README.md`.

## O que já vem pronto (não reimplementar)

- i18n pt/en tipado: `core/i18n` + `useTranslation()`. Toda string de UI entra
  em `core/i18n/pt.ts` (fonte da verdade) e `en.ts` (o tipo força paridade).
- Feedback: `core/feedback/submit.ts` → tabela `feedback` (insert-only RLS) ou
  fallback `mailto:` sem backend.
- Changelog: `core/changelog.ts` (entradas bilíngues, mais novo primeiro) com
  badge de não lido. Ao lançar feature relevante, adicionar entrada no TOPO.
- Auth guest-first: `core/auth/client.ts` (email+senha e Google via Supabase),
  UI só enxerga `AuthUser`. Sem env vars o app roda 100% local — preservar isso.
- Doações: `core/donate.ts` + `ui/screens/DonateScreen.tsx` — Stripe Payment
  Link via `VITE_STRIPE_DONATE_URL` (URL pública, sem secret). O item do menu
  só aparece configurado. Upgrade para Checkout dinâmico: ver README.
- Menu do topo direito: `ui/components/MenuSheet.tsx` — itens específicos do
  app entram no array `ITEMS`. Rodapé mostra versão + sha + hora do build
  (`VersionLabel`); 5 toques abrem o `/design`, toque longo abre o `/admin`.
- Painel de admin: `/admin` (lazy, sem link na UI), KPIs via RPCs
  `admin_metrics()`/`admin_feedback()` (security definer, allowlist
  `public.admins`). Eventos de uso: `core/analytics.ts` (`track()`,
  insert-only em `analytics_events`); o shell registra `session_start`.
- LLM via OpenRouter: `core/llm/client.ts` — `streamChat()` com dois modos
  atrás da mesma interface (proxy pela Edge Function `llm`, ou BYOK com a chave
  do próprio usuário), precedência resolvida em runtime. A chave do operador é
  secret do servidor; NUNCA criar `VITE_OPENROUTER_API_KEY`. Cota atômica com
  limite por usuário + global na migração `0003`. Sem UI de chat de propósito.
- Design system em três camadas — **primitivos** (valores crus em `:root`,
  `--palette-*`) → **tokens semânticos** (`@theme`, `--color-*`/`--radius-*`/
  `--text-*`, nomeados por papel) → **componentes** (`src/ui/design/`: `Button`,
  `IconButton`, `Card`, `Chip`, `Field`/`Input`/`Textarea`, `SectionTitle`,
  `Screen`/`ScreenBody`, `Sheet`). "Primitivo" aqui é token, nunca componente.
  Tema claro/escuro repontando só a camada semântica. Vitrine viva em `/design`
  (lazy, sem link), com alternador de tema.
- PWA + toast de atualização (`vite-plugin-pwa` modo prompt).

## Regras

- Acessibilidade: toda feature nova segue `ACCESSIBILITY.md` (contraste AA,
  teclado, leitor de tela, reduced motion — tem checklist no fim). Para painel
  modal, use o `Sheet` de `@ui/design` (Escape, trap e retorno de foco,
  `invisible` quando fechado) — não reimplemente. Nunca desabilitar zoom no
  viewport nem remover o `:focus-visible` global.

- **Design system — leia antes de escrever qualquer UI.** O reflexo natural de
  escrever Tailwind idiomático (`text-sm`, `rounded-2xl`, `bg-white`) está
  ERRADO neste projeto: ele fura a única camada que mantém dois apps
  consistentes. `npm run lint` roda `scripts/check-design-system.mjs` e QUEBRA
  se encontrar classe crua fora de `src/ui/design/`.

  Antes de escrever uma tela: abra `src/ui/design/index.ts` (a lista do que
  existe) e, se estiver com o app rodando, a rota `/design` (como cada coisa
  se parece).

  Tradução obrigatória — nunca escreva a coluna da esquerda:

  | Em vez de | Use |
  | --- | --- |
  | `text-xs` / `text-[11px]` | `text-label` |
  | `text-sm` | `text-body` |
  | `text-lg` | `text-title` |
  | `text-xl` | `text-metric` |
  | `text-2xl` | `text-display` |
  | `rounded-full` | `rounded-control` |
  | `rounded-2xl` (input) | `rounded-field` |
  | `rounded-2xl` (card) | `rounded-card` |
  | `px-4` (margem de tela) | `px-gutter` |
  | `<button>` estilizado na mão | `Button` / `IconButton` / `Chip` |
  | `<input>`/`<textarea>` na mão | `Input` / `Textarea`, dentro de `Field` |
  | `<div>` de card na mão | `Card` |
  | modal/sheet na mão | `Sheet` |
  | `flex h-full flex-col` + área rolável | `Screen` / `ScreenBody` |

  Classe crua do Tailwind é permitida só para **layout local** (`flex`, `grid`,
  `gap-*`, `mt-*`, `w-full`) — nunca para cor, raio, tipografia ou espaçamento
  de tela.

  Quando o caso não existir: adicione a **variante ao componente** em
  `src/ui/design/`, exporte no `design/index.ts` e mostre em `/design`. Não
  deixe a classe solta na tela e não crie um componente de UI fora de
  `design/`. Cor nova entra como **primitivo** em `:root` e é referenciada por
  um token semântico — nunca um hex direto no `@theme`. Para a exceção legítima e rara, comente `// ds-ok: <motivo>` na
  linha — o check respeita, mas exige o motivo escrito.

  Exceção única de i18n: `DesignScreen` é ferramenta de dev e mantém strings
  inline — traduzir rótulo de vitrine só poluiria a tabela de mensagens.

- Arquitetura "cérebro vs pele": nada em `src/core/` importa de `src/ui/` nem
  usa DOM. Aliases `@core/*`, `@ui/*`, `@app/*`.
- Todo acesso a backend passa por `core/backend/client.ts` (costura única —
  preparação para eventual migração AWS; ver README).
- Idioma da UI: português como default; toda string nova nasce nos dois idiomas.
- Sempre rodar `npm run lint`, `npm test` e `npm run build` antes de commitar.
- Segurança: seguir `SECURITY.md` (RLS na mesma migração, validação no banco,
  secrets nunca no código, host novo de API entra no `connect-src` da CSP do
  `vercel.json`). Lógica nova de `core/` ganha teste `*.test.ts` ao lado.
- Migrações em `supabase/migrations/`, numeradas, rodadas à mão no SQL Editor.
  Tabela nova = RLS habilitado + policies na mesma migração.
- NUNCA commitar service_role key ou qualquer secret (anon key pode).

## Sincronização com o app-boilerplate

Este repo é uma cópia do `alabreu/app-boilerplate` **sem histórico comum** —
`git merge` exigiria `--allow-unrelated-histories`. Para trazer melhorias de lá,
copie a árvore por cima preservando `docs/` e este `CLAUDE.md`, e rode
`npm run lint`, `npm test` e `npm run build` antes de commitar. A última
sincronização trouxe o boilerplate em `f992dd3`.

A paleta em `src/index.css` ainda é a do boilerplate — trocar pela do Mind Cache
é mudar só os `--palette-*` em `:root`, nunca os nomes semânticos do `@theme`.
Os ícones em `public/` são placeholders gerados por `npm run icons`.
