# Mind Cache — Especificação do Projeto

## Instruções para você (Claude Code)

Este documento é o escopo completo do projeto.

**Antes de escrever qualquer código**, leia a spec inteira e me devolva:

1. A estrutura de arquivos que você propõe
2. As decisões que a spec deixa ambíguas e como você pretende resolvê-las
3. A ordem em que você vai implementar

**Não implemente nada ainda — espere minha confirmação.**

Depois que eu confirmar, gere um `CLAUDE.md` na raiz contendo stack, convenções, schema e a seção "Fora de escopo" deste documento, para que essas decisões persistam entre sessões.

Implemente em fatias, na ordem definida na seção "Ordem de implementação". Pare ao fim de cada fatia e espere minha validação antes de seguir para a próxima.

---

## 0. Ponto de partida — usar o boilerplate

**Não faça scaffold do zero.** Este projeto começa a partir do meu repositório template `app-boilerplate`, que já contém o boilerplate que eu reuso em todos os meus apps (config de Supabase, auth, Tailwind, convenções de projeto, etc).

> URL do template: `github.com/alabreu/app-boilerplate`
> Forma de uso: "Use this template" no GitHub (criar novo repo a partir dele). Se você não tiver acesso ao GitHub daqui, eu clono localmente com `git clone https://github.com/alabreu/app-boilerplate mind-cache` e removo o histórico `.git` para começar limpo.

Antes de qualquer coisa:

1. Leia o conteúdo do template (README, `CLAUDE.md` se existir, estrutura de pastas, dependências no `package.json`, config já presente).
2. Me diga o que o template **já resolve** e o que ainda falta para atender a esta spec.
3. Trate a stack e as convenções do template como fonte de verdade. Se algo nesta spec conflitar com o que o template já estabelece, **não sobrescreva em silêncio** — me aponte o conflito e pergunte.

A seção "Stack" abaixo descreve o alvo. Onde o boilerplate já provê algo equivalente, use o que já existe em vez de reinstalar.

---

## 1. Contexto e problema

Web app pessoal (single-user) para capturar informações soltas — links, ideias, trechos de texto — e recuperá-las depois via busca.

Hoje eu uso uma conversa comigo mesmo no WhatsApp para isso. Funciona bem para **capturar** e é péssimo para **recuperar**. O Mind Cache resolve a recuperação sem piorar a captura.

**Princípio central:** capturar tem que ser mais rápido do que abrir o WhatsApp. Zero fricção na entrada. Organização acontece depois, automaticamente, ou nunca.

**Metáfora do nome:** é um *cache*, não um arquivo. Coisas entram rápido, saem rápido, e nem tudo precisa sobreviver para sempre.

---

## 2. Stack

- **Next.js** (App Router) + TypeScript
- **Supabase** — Postgres + Auth
- **Tailwind CSS**
- **Deploy:** Vercel
- **LLM (pós-v1):** OpenRouter

Não introduza dependências além dessas sem me perguntar antes.

---

## 3. Schema do banco

```sql
create extension if not exists pg_trgm;

create table items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  raw_text text not null,
  url text,
  title text,
  note text,
  tags text[] default '{}',

  source text default 'web',          -- 'web' | 'whatsapp'
  external_id text,                   -- message_id do WhatsApp, para idempotência

  pinned boolean default false,
  archived boolean default false,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_accessed_at timestamptz,

  search_vector tsvector generated always as (
    to_tsvector('portuguese',
      coalesce(title,'') || ' ' || coalesce(raw_text,'') || ' ' || coalesce(note,'')
    )
  ) stored
);

create index items_search_idx  on items using gin(search_vector);
create index items_trgm_idx    on items using gin(raw_text gin_trgm_ops);
create index items_created_idx on items(user_id, created_at desc);
create index items_tags_idx    on items using gin(tags);

create unique index items_external_idx on items(source, external_id)
  where external_id is not null;

alter table items enable row level security;

create policy "own items" on items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

**Notas sobre o schema:**

- `to_tsvector('portuguese', ...)` funciona bem para texto em português, mas faz stemming ruim em termos técnicos em inglês. O índice trigram compensa: busca parcial e erros de digitação caem nele.
- O índice único parcial em `(source, external_id)` é essencial. A Meta reenvia webhooks em caso de falha; sem ele, itens duplicam.
- `last_accessed_at` não é usado na v1. Está aqui porque a v3 depende dele e é mais barato ter a coluna desde o início.

---

## 4. Escopo da v1

### 4.1 Captura

- Campo de texto único, **sempre focado ao abrir o app**.
- `Enter` envia. `Shift+Enter` quebra linha.
- Detecção automática de URL no texto: se houver, extrair para a coluna `url` e buscar o `<title>` da página server-side, com **timeout de 3 segundos**. Falha é silenciosa e não bloqueia o salvamento.
- **Update otimista:** o item aparece na lista imediatamente e sincroniza em background. Se falhar, sinalizar no próprio item com opção de retentar.

### 4.2 Lista

- Ordem cronológica reversa. Itens `pinned` no topo.
- Paginação infinita, 30 por vez.
- Cada item exibe: título ou as primeiras ~2 linhas do texto, domínio (se for link), tempo relativo ("há 3 dias"), tags.
- Ações inline: copiar, abrir link, fixar, arquivar, deletar.
- Clique expande para ver o texto completo e editar título, nota e tags.

### 4.3 Busca

- Campo no topo, com debounce de 200ms.
- Query combinada: `websearch_to_tsquery` sobre `search_vector`, com fallback trigram (`similarity > 0.2`) quando o full-text não retorna nada.
- Highlight dos termos nos resultados.
- Filtros: por tag (chips clicáveis) e toggle "incluir arquivados".

### 4.4 Captura externa

Não deixe para depois — isto é o que determina se o hábito migra.

- `manifest.json` com `share_target` configurado: method `POST`, `enctype: multipart/form-data`, aceitando `title`, `text` e `url`.
- Rota que recebe o share, salva e redireciona para a home.
- Service worker mínimo, apenas para habilitar a instalação como PWA.
- Bookmarklet gerado na tela de configurações, com o texto pronto para arrastar até a barra de favoritos.

### 4.5 Auth

Supabase Auth com magic link por e-mail. Nada além disso.

---

## 5. Webhook do WhatsApp (parte da v1, implementar por último)

O WhatsApp é um **canal de coleta burro**. Ele não conversa, não interpreta, não chama LLM. Recebe, valida, insere, confirma.

### 5.1 Fluxo

```
WhatsApp → Webhook (Next.js route handler)
              ↓
         responde 200 imediatamente
              ↓
         valida assinatura (X-Hub-Signature-256) + whitelist do meu número
              ↓
         insere em `items` com source='whatsapp' e external_id=message_id
              ↓
         reage ✅ na mensagem original (ou ❌ se o insert falhar)
```

### 5.2 Regras não-negociáveis

- **Usar a Cloud API oficial da Meta.** Não usar `whatsapp-web.js`, Baileys ou qualquer biblioteca que automatize o WhatsApp Web — violam os termos de uso e arriscam banimento do número.
- **Responder 200 antes de processar.** A Meta reenvia se houver demora.
- **Reagir só depois de o insert confirmar.** Um ✅ mentindo é pior que ausência de sinal, porque eu não vou voltar para conferir.
- **Falha precisa ser visível.** Se o insert der erro, reagir com ❌. Silêncio é ambíguo demais.
- **Validar a assinatura do webhook** e ignorar mensagens de qualquer número fora da whitelist.

### 5.3 Reação

`POST` no endpoint de mensagens da Cloud API com `type: "reaction"`, apontando para o `message_id` da mensagem recebida e o emoji.

### 5.4 Variáveis de ambiente

```
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
WHATSAPP_ALLOWED_NUMBERS=
```

---

## 6. Fora de escopo na v1

Não implemente, não sugira, não deixe stubs para:

- Qualquer chamada de LLM
- Embeddings, busca semântica, RAG
- Categorização ou resumo automático
- Upload de imagem ou arquivo
- Modo offline / fila de sincronização
- Tema claro/escuro configurável — escolha um e siga
- Multi-usuário, compartilhamento, colaboração
- App nativo ou wrapper

---

## 7. Design

A referência mental é um terminal ou um cliente de e-mail, **não** um app de notas bonito.

- Interface densa e rápida, não espaçosa
- Fonte pequena, alto contraste
- Transições curtas ou nenhuma
- Atalhos de teclado: `/` foca a busca, `n` foca a captura, `Esc` limpa

Eu tenho background em design e vou iterar bastante nesta parte. Priorize estrutura correta e comportamento, não polimento visual — eu dirijo o visual.

---

## 8. Ordem de implementação

Pare e espere minha validação ao fim de cada fatia. Commit a cada uma.

1. **Setup a partir do boilerplate + migration do Postgres + RLS.** Partir do template (seção 0), conectar ao meu projeto Supabase, rodar e testar a migration antes de seguir.
2. **Auth com magic link.** Conseguir logar.
3. **Captura + lista.** O loop mínimo funcionando.
4. **Busca.**
5. **PWA + share target + bookmarklet.**
6. **Webhook do WhatsApp.**

---

## 9. Roadmap pós-v1

Não implemente nada desta seção. Está aqui para que as decisões da v1 não fechem essas portas.

### v1.5 — Enriquecimento

Só depois de duas semanas de uso real.

Fila de processamento assíncrono: quando um item entra, uma função chama um LLM que gera título limpo, resumo de uma linha e 2–4 tags sugeridas. Para URLs, buscar o conteúdo da página antes (Jina Reader ou similar).

Regras:

- Guardar em colunas separadas — `ai_title`, `ai_summary`, `ai_tags` — para nunca sobrescrever o que foi escrito à mão, e para poder desligar tudo se a qualidade decepcionar.
- O webhook do WhatsApp **nunca** chama LLM. O enriquecimento roda depois, disparado por trigger ou cron, sem saber de onde o item veio. WhatsApp e web app entram pela mesma fila.
- Pedir JSON estruturado e **validar com Zod** antes de gravar. Modelo barato erra formato; o custo de um retry é irrisório perto do de gravar lixo no banco.
- Manter as tags sugeridas separadas das minhas e medir com que frequência eu corrijo. Correção frequente costuma indicar prompt ruim ou falta de vocabulário fixo de tags, não modelo ruim.

### v2 — Busca semântica

`pgvector`, embeddings de cada item, busca híbrida combinando o rank do full-text com similaridade de cosseno. Resolve o caso "lembro do assunto mas não das palavras exatas".

Atenção: o OpenRouter é focado em chat completions e a cobertura de embeddings é limitada. Provavelmente vai precisar de outro provedor.

### v2.5 — Modo pergunta

RAG. Pergunta em linguagem natural, recupera os itens mais relevantes, responde **citando as fontes** com link para cada item usado. A citação não é enfeite: sem ela eu não confio na resposta, e um cache em que eu não confio não serve para nada.

### v3 — Manutenção do cache

O que um cache faz e um arquivo não:

- Sugerir arquivamento do que nunca foi acessado (usa `last_accessed_at`)
- Detectar links quebrados
- Agrupar itens duplicados ou relacionados
- Tela de revisão periódica mostrando o que entrou nas últimas semanas e nunca foi tocado

Esta é a feature que a maioria dos apps de bookmark não tem, e é a razão pela qual eles viram cemitério.

---

## 10. Configuração de LLM (para quando chegar a v1.5)

Dois usos com perfis diferentes. Separar em config desde o início — trocar modelo deve ser mudança de variável de ambiente, não refactor.

```
OPENROUTER_API_KEY=
MODEL_ENRICH=     # alto volume, background, tarefa simples → modelo barato e rápido
MODEL_CHAT=       # baixo volume, usuário esperando, qualidade é o produto → modelo bom
```
