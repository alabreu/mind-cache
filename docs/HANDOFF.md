# Handoff — comece por aqui

Este arquivo existe para que uma sessão nova (app mobile, web ou outra máquina)
consiga retomar o Mind Cache sem depender de nenhuma conversa anterior. Nada do
que foi discutido antes está disponível — o que vale é o que está commitado.

**Ordem de leitura:** este arquivo → `CLAUDE.md` → `docs/SPEC.md`.

Escrito em 2026-08-03, com o repo em `7575d45` ("Início a partir do
app-boilerplate").

---

## 1. Onde o projeto está

Praticamente no zero. O repo é uma cópia do template `app-boilerplate`
(React + Vite + TS + Tailwind v4 + Supabase + Vercel), sem nenhum código do
Mind Cache ainda. Nada da spec foi implementado — nem a migration, nem auth,
nem captura.

O histórico do template foi descartado: existe **um único commit**, sem
ancestral comum com `alabreu/app-boilerplate`. Isso importa para a
sincronização descrita na seção 3.

---

## 2. Decisões em aberto — pergunte, não escolha

Estas quatro questões estão **deliberadamente sem resposta**. O dono do projeto
optou por decidi-las depois. A seção 0 da spec é explícita: conflito entre a
spec e o template não se resolve em silêncio.

**Não comece a fatia 1 sem fechar pelo menos a nº 1 abaixo.** Ela determina a
estrutura inteira do projeto e é cara de reverter depois.

### 2.1 Stack: Next.js ou React + Vite? (bloqueante)

A spec se contradiz:

- **§2 (Stack)** pede Next.js com App Router.
- **§0 (Ponto de partida)** manda partir do `app-boilerplate` e tratar a stack
  dele como fonte de verdade — e o boilerplate é **React + Vite**, não Next.

As duas saídas, com o custo de cada uma:

| Caminho | Ganha | Perde |
|---|---|---|
| Manter Vite + boilerplate | i18n pt/en tipado, auth, feedback, changelog, painel de admin, analytics e PWA já prontos | Não há route handlers; o webhook do WhatsApp (§5) e o fetch de `<title>` server-side (§4.1) precisam ir para Supabase Edge Functions ou Vercel Functions |
| Next.js do zero | Segue a §2 literalmente; route handlers nativos resolvem §4.1 e §5 | Descarta o boilerplate inteiro e tudo que ele já resolve |

### 2.2 Ritmo de trabalho

A **§8** manda parar e esperar validação ao fim de cada fatia, com commit a
cada uma. Isso pressupõe alguém disponível para revisar. Se a sessão for rodar
com o dono AFK, confirme antes quantas fatias pode atravessar sem parar — e, na
dúvida, pare conforme a spec original manda.

### 2.3 Auth

A **§4.5** pede magic link por e-mail e "nada além disso". O boilerplate traz
e-mail+senha e Google via Supabase, além de um modo guest-first que faz o app
rodar 100% local sem env vars. Trocar por magic link significa mexer em
`core/auth/client.ts` — decidir se é substituição ou adição.

### 2.4 Tema

A **§6** manda escolher um tema e não oferecer toggle. Falta dizer qual. A §7
pede "fonte pequena, alto contraste, densa, referência de terminal", o que
sugere escuro, mas isso é inferência — confirme.

---

## 3. Sincronização pendente com o app-boilerplate

O `app-boilerplate` continuou evoluindo depois que esta cópia foi feita, e o
dono pretende sincronizar quando terminar os últimos commits por lá. **Espere
ele pedir** — não sincronize por conta própria.

Na data deste handoff o boilerplate estava em `36ac8ab` e estes arquivos já
divergiam:

- `package.json`
- `package-lock.json`
- `.github/workflows/ci.yml`
- `.github/dependabot.yml`

Todos vêm de PRs de Dependabot e de CI (bump de `actions/checkout`,
`actions/setup-node`, `@types/node`, `vite-plugin-pwa`, e agrupamento da
família React no Dependabot).

Como os dois repos **não compartilham histórico**, `git merge` exigiria
`--allow-unrelated-histories` e criaria um histórico confuso. Copiar os
arquivos divergentes à mão é mais simples e mais previsível, e permite conferir
arquivo a arquivo.

Ao sincronizar, cuidado com dois arquivos que **não** devem ser sobrescritos
cegamente, porque carregam conteúdo específico do Mind Cache:

- `CLAUDE.md` — tem um bloco no topo apontando para este handoff e para a spec
- `docs/` — não existe no boilerplate

---

## 4. O que não fazer

Da **§6** da spec, fora de escopo na v1 — não implemente, não sugira, não deixe
stub: chamada de LLM, embeddings/busca semântica/RAG, categorização ou resumo
automático, upload de arquivo, modo offline, toggle de tema, multi-usuário, app
nativo.

A **§9** (roadmap pós-v1) existe só para não fechar portas. Não implemente nada
dela.

E as regras não-negociáveis do webhook, na **§5.2** — em especial: usar a Cloud
API oficial da Meta, nunca `whatsapp-web.js` ou Baileys.
