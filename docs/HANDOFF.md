# Handoff — comece por aqui

Este arquivo existe para que uma sessão nova consiga retomar o Mind Cache sem
depender de nenhuma conversa anterior. Nada do que foi discutido antes está
disponível — o que vale é o que está commitado.

**Ordem de leitura:** este arquivo → `CLAUDE.md` → `docs/SPEC.md`.

Atualizado em 2026-08-04, com a v1 da spec implementada nas seis fatias da §8.

---

## 1. Onde o projeto está

As seis fatias da §8 estão commitadas, uma por commit, cada uma com o porquê das
decisões na mensagem. `npm run lint`, `npm test` (84 testes) e `npm run build`
passam.

| Fatia | O que entrou |
| --- | --- |
| 1 | `items` com RLS, índices e idempotência (`0004_items.sql`) |
| 2 | Auth do boilerplate, sem mudanças |
| 3 | Captura otimista, lista, edição inline, Edge Function `fetch-title` |
| 4 | Busca full-text + fallback trigram (`0005_search_items.sql`), realce, chips de tag |
| 5 | PWA em `injectManifest`, `share_target` por POST, bookmarklet |
| 6 | Webhook do WhatsApp como Edge Function |

**O que NÃO foi feito, e é o próximo passo:** nada disso rodou contra um Supabase
de verdade. Não existe projeto do Mind Cache na conta — só CoBuilder e Vamo
Onde. Ver a seção 2.

## 2. O que falta para o app rodar

Nesta ordem:

1. Criar o projeto no Supabase e pôr `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` no `.env` e na Vercel. Sem isso a home diz "falta
   configurar o backend" — de propósito, para não oferecer um "entrar" que não
   leva a lugar nenhum.
2. Rodar `supabase/migrations/` em ordem no SQL Editor. As migrações 0004 e 0005
   foram validadas num Postgres 16 local com `auth.users`/`auth.uid()` stubados,
   mas nunca num projeto real.
3. `supabase functions deploy fetch-title` (o `<title>` das URLs capturadas).
4. Para o WhatsApp: os secrets listados no `.env.example` e
   `supabase functions deploy whatsapp --no-verify-jwt`.

Só depois disso dá para exercitar o caminho logado ponta a ponta — captura,
lista, busca e webhook. Hoje o que está verificado é: o app carrega no Chromium
sem erro de console, as migrações aplicam e se comportam num Postgres local, e a
lógica pura (URL, realce, tempo relativo, share, assinatura do webhook) tem
testes.

## 3. Decisões já fechadas — não reabra sozinho

As quatro que este handoff deixava em aberto foram decididas pelo dono e valem
como estão. O quadro completo, com o motivo de cada uma, está na seção "Onde a
spec foi superada" do `CLAUDE.md`:

- **Stack:** React + Vite (o boilerplate), não Next.js.
- **Auth:** e-mail+senha e Google, como o boilerplate entrega. Sem magic link.
- **Tema:** acompanha o sistema, sem toggle na UI.
- **Backend server-side:** Supabase Edge Functions.

Duas outras divergências da spec foram decididas por evidência, não por
preferência, e estão documentadas no código e nos commits:

- A §4.3 pede fallback trigram com `similarity > 0.2`. Medido, isso quase nunca
  dispara — o que funciona é `word_similarity`. Ver `CLAUDE.md`.
- A §5.1 desenha o 200 antes da validação da assinatura. Aqui a assinatura vem
  primeiro; ver a mensagem do commit da fatia 6.

## 4. Sincronização com o app-boilerplate

Feita em 2026-08-04, trazendo o boilerplate em `f992dd3`. Como os repos não
compartilham histórico, o método é copiar a árvore por cima preservando `docs/`
e o `CLAUDE.md` — ver a seção "Sincronização com o app-boilerplate" no
`CLAUDE.md`.

**Uma correção deve voltar para o boilerplate:** `src/core/llm/client.test.ts`
cravava o slug `meu-app` em vez de derivar de `storageKey()`, e por isso quebrava
em todo app renomeado. Corrigido aqui no commit da sincronização.

## 5. O que não fazer

Da §6 da spec, fora de escopo na v1 — não implemente, não sugira, não deixe
stub: chamada de LLM (o `core/llm` do boilerplate fica sem uso aqui),
embeddings/busca semântica/RAG, categorização ou resumo automático, upload de
arquivo, modo offline, toggle de tema, multi-usuário, app nativo.

A §9 (roadmap pós-v1) existe só para não fechar portas. Não implemente nada dela.

E a regra inegociável da §5.2: Cloud API oficial da Meta, nunca `whatsapp-web.js`
ou Baileys.
