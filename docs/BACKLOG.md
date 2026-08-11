# Backlogs

Dois backlogs, de propósito separados:

- **Backlog manual** — depende de ação do dono. O Claude não consegue fazer
  sozinho: exige conta em serviço de terceiro, cartão, decisão de gosto ou
  acesso que a sessão não tem.
- **Backlog do projeto** — trabalho de código/produto que o Claude pode tocar
  quando for priorizado.

Prioridade: 🔴 bloqueia · 🟡 importante, não bloqueia · 🟢 quando der

Atualizado em 2026-08-05.

---

## Backlog manual (ações do dono)

| | Item | Por quê / detalhe |
| --- | --- | --- |
| 🔴 | Env vars na Vercel + redeploy | `VITE_SUPABASE_URL=https://rsbphkkjxookwpvkgjsi.supabase.co` e a anon key. São de **build**, então só valem em deploy novo. Sem isso o app fica na tela "falta configurar o backend" |
| 🔴 | Redirect URLs no Supabase | Authentication → URL Configuration: `https://mind-cache-umber.vercel.app` e `http://localhost:5173`. Sem isso o login volta para o lugar errado |
| 🟡 | Criar a própria conta no app | O primeiro login gera o `user_id` que vira o `MIND_CACHE_OWNER_ID` do webhook. Nada do WhatsApp anda antes disso |
| 🟡 | SMTP customizado no Supabase | O SMTP padrão manda poucos e-mails por hora e a própria documentação do Supabase diz que não é para produção. Para uso só seu funciona; vira **pré-requisito** no dia que abrir para outros usuários, porque é dele que depende o link de confirmação |
| 🟡 | Credenciais OAuth do Google | Só se quiser o login com Google: criar no Google Cloud Console (tipo "Web application", redirect `https://rsbphkkjxookwpvkgjsi.supabase.co/auth/v1/callback`) e colar no Supabase |
| 🟡 | App na Meta / WhatsApp Cloud API | Obter `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, escolher o `WHATSAPP_VERIFY_TOKEN` e apontar o webhook para `https://rsbphkkjxookwpvkgjsi.supabase.co/functions/v1/whatsapp` |
| 🟡 | Entrar em `public.admins` | Só se quiser usar o `/admin`. É um insert no SQL Editor — a tabela é inalterável pela API de propósito |
| 🟢 | Paleta do Mind Cache | `src/index.css`, só os `--palette-*` em `:root`. A §7 pede denso e alto contraste, mas a spec diz que **você dirige o visual** |
| 🟢 | Ícones reais em `public/` | Hoje são placeholders do `npm run icons` |
| 🟢 | Conferir a fatura do Supabase | O terceiro projeto entrou a US$ 10/mês; vale ver como o crédito de compute do Pro se aplica |
| 🟢 | Decidir visibilidade do repo | Está **público**. A anon key é pública por design e protegida por RLS, então não é vazamento — mas é uma escolha, não um acidente a confirmar |
| 🟢 | Apagar a branch `fix/ios-input-zoom` no boilerplate | Já mergeada na `main` (`f62a523`). A branch remota sobreviveu porque o proxy da sessão recusa deleção de ref, e ela aponta para o commit **anterior ao amend** — o que ainda tinha o ruído no `package-lock.json`. Apagar pelo GitHub evita alguém partir dela |
| 🟢 | Levar a correção do teste de volta ao boilerplate | `src/core/llm/client.test.ts` crava o slug `meu-app` em vez de derivar de `storageKey()`, e quebra em todo app renomeado. Ainda **não** foi para lá — a branch acima trata só do zoom |
| 🟢 | Domínio próprio na Vercel | Opcional |

---

## Backlog do projeto (código e produto)

| | Item | Por quê / detalhe |
| --- | --- | --- |
| 🔴 | Validar o caminho logado ponta a ponta | Captura, lista, busca, edição inline, share target no celular e bookmarklet nunca rodaram com sessão real. Depende das env vars acima |
| 🟡 | Densidade da §7 | O design system do boilerplate é espaçoso; a §7 pede terminal — fonte pequena, denso, alto contraste. Precisa de variantes novas em `src/ui/design/`, não de classe solta na tela |
| 🟡 | `extractUrl` duplicado | Existe em `src/core/items/url.ts` e em `supabase/functions/whatsapp/lib.ts`, porque a Edge Function roda em Deno e não alcança `src/`. Os dois têm teste, mas podem divergir |
| 🟡 | Sem teste de componente | O boilerplate não traz jsdom/testing-library, então `useItems`, `CaptureField` e `ItemRow` só têm cobertura indireta. A lógica pura tem teste |
| 🟡 | Botão do Google aparece com o provedor desligado | Vem do boilerplate. Clicar leva a uma página de JSON cru (`provider is not enabled`) fora do app, em vez de o botão simplesmente não existir. O endpoint `/auth/v1/settings` do Supabase informa quais provedores estão ligados — dá para esconder o botão sozinho, sem env var nova |
| 🟡 | `ALLOWED_ORIGIN` das Edge Functions está `*` | Restringir ao domínio da Vercel depois que ele estabilizar |
| 🟢 | Chaves i18n sem uso | `items.expand`, `items.collapse` e `items.loadMore` foram criadas e não são usadas em tela. Ou usar (rótulo do botão de expandir melhora leitor de tela) ou remover |
| 🟢 | `openrouter.ai` no `connect-src` da CSP | Herdado do boilerplate; LLM está fora do escopo da v1, então poderia sair |
| 🟢 | DNS rebinding no `fetch-title` | Limite conhecido e documentado no arquivo: a trava é por hostname, e o runtime não expõe o que seria preciso para fechar de verdade |
| 🟢 | Paginação por offset | Escolhida porque "fixados primeiro" atrapalha cursor. Se a janela deslocar de um jeito incômodo na rolagem, revisitar |
| 🟢 | Migração `0003_llm_usage` não aplicada | De propósito: LLM está fora da v1. Fica aqui para não ser esquecida se um dia entrar |
| 🟢 | Roadmap pós-v1 (§9 da spec) | v1.5 enriquecimento com LLM · v2 busca semântica com pgvector · v2.5 modo pergunta (RAG com citação) · v3 manutenção do cache, que é o que usa o `last_accessed_at` |
