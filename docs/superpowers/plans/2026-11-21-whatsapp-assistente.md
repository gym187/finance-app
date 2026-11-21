# Assistente financeiro no WhatsApp — Plano de Implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Usuários vinculam seu WhatsApp ao AppFin e lançam transações / fazem consultas por texto ou áudio, com OpenAI e Evolution API.

**Architecture:** Módulo `apps/backend/src/whatsapp/` dentro do backend. A Evolution API (container) chama `POST /api/whatsapp/webhook`; o handler identifica o usuário vinculado, transcreve áudio, tenta atalhos sem IA e, senão, roda um agente OpenAI com tool calling que usa os services existentes (sempre com o `userId` do remetente). Envio/recebimento ficam atrás da interface `WhatsappProvider`.

**Tech Stack:** Node 20, Express 4, TypeScript (CommonJS), Prisma 5, Zod, pacote `openai`, Vitest (novo), Next.js 15 + TanStack Query (frontend), Docker Compose.

**Spec:** `docs/superpowers/specs/2026-11-21-whatsapp-assistente-design.md`

## Global Constraints

- Telegram (`apps/backend/src/bot/`) não é tocado.
- Fuso: America/Sao_Paulo (UTC-3); datas "de hoje" usam `nowBR()` de `apps/backend/src/config/date.ts`. Lançamentos em BRL (`currency: 'BRL'`).
- Textos ao usuário em pt-BR, valores como `R$ 1.234,56`.
- Módulo desligado (rota do webhook responde 404, nada é iniciado) se faltar qualquer uma de: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WHATSAPP_WEBHOOK_SECRET`, `OPENAI_API_KEY`. Todas opcionais no `env.ts`.
- Env adicionais: `OPENAI_TRANSCRIBE_MODEL`, `OPENAI_CHAT_MODEL` (padrão `gpt-5-nano`), `WHATSAPP_BOT_NUMBER` (só exibição/`wa.me`), `WHATSAPP_DAILY_LIMIT` (padrão `100`).
- Código de vínculo: 6 dígitos, expira em 10 min, uso único, 1 ativo por usuário.
- Lançamento pendente: em memória, expira em 10 min. Histórico: em memória, últimas 10 mensagens, expira em 30 min sem atividade. Agente: no máximo 5 iterações de tool calling.
- Tentativas de código de vínculo: no máximo 5 falhas por remetente (jid) por hora e 50 falhas por hora no total; acima disso, silêncio (nem consulta o banco nem responde). Falha = código `invalid` ou `in_use`.
- Áudio > 120 s é recusado. Rate limit por usuário: 30 mensagens / 10 min, mais teto diário `WHATSAPP_DAILY_LIMIT`.
- Webhook: segredo no header `x-webhook-secret` (comparação em tempo constante) e 404 para requisições com header `cf-ray` ou `cf-connecting-ip`; montado em `app.ts` **antes** do rate limit global.
- Evolution: porta 8080 publicada só em `127.0.0.1`; banco `evolution` dentro do container `finance_postgres` existente. **Nunca** subir outra instância de Postgres nem outro compose usando o volume `pgdata` (incidente de 17/11/2026).
- `Transaction.categoryId` é obrigatório: fallback "Outros", senão primeira categoria; sem categorias, o bot pede para criar uma no app. Nunca cria categoria.
- `package-lock.json` já tem alteração local não relacionada: ao instalar dependências, avise o usuário antes de commitá-lo.

## Review Focus

1. Webhook reenviado (mesmo `message.key.id`) não pode lançar duas vezes — Task 4.
2. Valor 0, negativo, `NaN` ou texto vindo do modelo não pode gravar lançamento — Task 9.
3. "sim" sem pendência (ou com pendência expirada / de outro usuário) responde que não há lançamento pendente e não grava — Task 9 e 10.
4. Áudio cuja transcrição vem vazia pede para repetir e não chama o agente — Task 10.
5. Código de vínculo reutilizado, expirado ou número já vinculado a outra conta não vincula — Task 5.
6. Adivinhar o código de 6 dígitos por força bruta (remetente desconhecido mandando muitos códigos): após 5 falhas do mesmo remetente ou 50 no total por hora, nem um código válido vincula e o bot não responde — Tasks 6 e 10.

---

## File Structure

```
apps/backend/
  vitest.config.ts                          (novo)
  src/config/env.ts                         (modifica: novas envs)
  src/app.ts                                (modifica: monta webhook antes do rate limit)
  src/routes/index.ts                       (modifica: router /whatsapp autenticado)
  src/whatsapp/
    phone.ts            normalização / variantes do 9º dígito
    provider.ts         tipos IncomingMessage + interface WhatsappProvider
    evolution.provider.ts   implementação Evolution (parseWebhook, sendText, getAudio)
    webhook.guard.ts    segredo + bloqueio Cloudflare + dedupe
    link.service.ts     códigos de vínculo, lookup de usuário, unlink, status
    link.routes.ts      rotas autenticadas /api/whatsapp/*
    usage.ts            rate limit por usuário/dia e throttle de remetentes desconhecidos
    format.ts           formatBRL, normalizeText
    shortcuts.ts        atalhos sem IA
    llm.ts              interface LlmClient + implementação OpenAI
    conversation.ts     histórico e pendência em memória
    tools.ts            ferramentas do agente + confirmPending/cancelPending
    agent.ts            prompt de sistema + loop de tool calling
    handler.ts          orquestração de uma mensagem recebida
    webhook.controller.ts   200 imediato + handler assíncrono
    __tests__/*.test.ts
prisma/schema.prisma + migration           (modifica)
apps/frontend/src/{lib/api.ts, hooks/useWhatsapp.ts, app/(dashboard)/whatsapp/page.tsx, components/layout/Sidebar.tsx, Header.tsx}
docker-compose.yml, .env.example?, docs/whatsapp-setup.md
```

---

### Task 1: Vitest + normalização de telefone

**Files:**
- Create: `apps/backend/vitest.config.ts`, `apps/backend/src/whatsapp/phone.ts`, `apps/backend/src/whatsapp/__tests__/phone.test.ts`
- Modify: `apps/backend/package.json` (script `"test": "vitest run"`, devDependency `vitest`), `apps/backend/tsconfig.json` (`"exclude": ["src/**/*.test.ts", "src/**/__tests__/**"]`)

**Interfaces:**
- Produces: `normalizePhone(input: string): string | null` — só dígitos; 10–11 dígitos ganham prefixo `55`; resultado precisa ter 12–13 dígitos começando com `55`, senão `null`. `phoneVariants(phone: string): string[]` — o número e a variante com/sem o `9` após o DDD (`5511999998888` ↔ `551199998888`), sem duplicatas.

- [ ] **Step 1:** Criar branch `feat/whatsapp` a partir de `stable`; commitar o spec e este plano (`git add docs/superpowers`).
- [ ] **Step 2:** `npm install -D vitest --workspace=apps/backend`; criar `vitest.config.ts` (ambiente node, `include: ['src/**/*.test.ts']`); adicionar script `test` e o `exclude` no tsconfig.
- [ ] **Step 3: Testes** em `phone.test.ts`: `normalizePhone('(11) 99999-8888') === '5511999998888'`; `normalizePhone('+55 11 99999-8888') === '5511999998888'`; `normalizePhone('1199998888') === '551199998888'`; `normalizePhone('123')` e `normalizePhone('abc')` → `null`; `phoneVariants('5511999998888')` contém `'5511999998888'` e `'551199998888'`; `phoneVariants('551199998888')` contém ambos; sem duplicatas.
- [ ] **Step 4:** `npm test --workspace=apps/backend` → FAIL (módulo inexistente).
- [ ] **Step 5:** Implementar `phone.ts`.
- [ ] **Step 6:** `npm test --workspace=apps/backend` → PASS; `npm run build --workspace=apps/backend` → sem erro e sem testes em `dist/`.
- [ ] **Step 7:** Commit `feat(whatsapp): vitest e normalização de telefone`.

---

### Task 2: Schema, migration e variáveis de ambiente

**Files:**
- Modify: `prisma/schema.prisma`, `apps/backend/src/config/env.ts`
- Create: `prisma/migrations/20261121000000_add_whatsapp/migration.sql` (gerada pelo Prisma)

**Interfaces:**
- Produces: `User.whatsappPhone String? @unique`, `User.whatsappJid String? @unique`; model `WhatsappLinkCode { id Int @id @default(autoincrement()); userId Int @unique; code String @unique; expiresAt DateTime; createdAt DateTime @default(now()); user User @relation(onDelete: Cascade) }` (relação inversa `whatsappLinkCode WhatsappLinkCode?` em `User`). `env` ganha as variáveis dos Global Constraints, mais helper exportado `whatsappEnabled: boolean` em `env.ts`.

- [ ] **Step 1:** Editar o schema e rodar `npm run db:migrate --workspace=apps/backend -- --name add_whatsapp` em banco de dev; conferir que o SQL só adiciona colunas/tabela (nenhum `DROP`).
- [ ] **Step 2:** Adicionar as envs ao `envSchema` (todas `z.string().optional()`; `OPENAI_CHAT_MODEL` default `gpt-5-nano`; `WHATSAPP_DAILY_LIMIT` `z.coerce.number().int().positive().default(100)`; `OPENAI_TRANSCRIBE_MODEL` default `gpt-4o-mini-transcribe`) e exportar `whatsappEnabled`.
- [ ] **Step 3:** Conferir na página oficial de preços/modelos da OpenAI qual modelo de transcrição está vigente (o spec registra que `gpt-4o-mini-transcribe` pode estar descontinuado; candidato `gpt-transcribe`) e ajustar o default.
- [ ] **Step 4:** `npm run build --workspace=apps/backend` → sem erro. Commit `feat(whatsapp): schema, migration e env`.

---

### Task 3: Provider (interface + Evolution)

**Files:**
- Create: `apps/backend/src/whatsapp/provider.ts`, `evolution.provider.ts`, `__tests__/evolution.provider.test.ts`

**Interfaces:**
- Produces (`provider.ts`):
  ```ts
  export interface IncomingMessage {
    id: string; jid: string; phone: string | null;
    fromMe: boolean; isGroup: boolean;
    kind: 'text' | 'audio' | 'other';
    text?: string; audioSeconds?: number;
  }
  export interface WhatsappProvider {
    parseWebhook(body: unknown): IncomingMessage | null;
    sendText(jid: string, text: string): Promise<void>;
    getAudio(msg: IncomingMessage): Promise<Buffer>;
  }
  ```
- Produces (`evolution.provider.ts`): `export const evolutionProvider: WhatsappProvider` (usa `fetch` nativo e `env.EVOLUTION_*`).

- [ ] **Step 1: Testes** de `parseWebhook` com payloads v2 `messages.upsert` (conferir o formato real na doc da versão fixada na Task 12): texto via `conversation` e via `extendedTextMessage.text` → `kind:'text'`; `audioMessage` com `seconds: 7` → `kind:'audio', audioSeconds: 7`; imagem → `kind:'other'`; `remoteJid` terminando em `@g.us` → `isGroup:true`; `key.fromMe:true` → `fromMe:true`; `@s.whatsapp.net` → `phone` só com dígitos; `@lid` → `phone: null` (usar o telefone alternativo do payload se a Evolution fornecer); evento diferente de `messages.upsert` ou corpo inválido → `null`.
- [ ] **Step 2:** Rodar → FAIL. **Step 3:** Implementar `parseWebhook` (valida com Zod permissivo, sem lançar exceção).
- [ ] **Step 4:** Implementar `sendText` (`POST {EVOLUTION_API_URL}/message/sendText/{EVOLUTION_INSTANCE}`, header `apikey`, corpo `{ number: jid, text }`; lança erro se status não-2xx) e `getAudio` (`POST /chat/getBase64FromMediaMessage/{instance}` com a key da mensagem; decodifica base64 em `Buffer`). Teste de `sendText` com `fetch` mockado verificando URL, header `apikey` e corpo.
- [ ] **Step 5:** Rodar → PASS. Commit `feat(whatsapp): provider Evolution`.

---

### Task 4: Guarda do webhook, dedupe e montagem em app.ts

**Files:**
- Create: `apps/backend/src/whatsapp/webhook.guard.ts`, `__tests__/webhook.guard.test.ts`
- Modify: `apps/backend/src/app.ts` (montagem provisória do webhook: ver Task 10 para o controller; aqui monta a guarda e um handler 200 vazio)

**Interfaces:**
- Produces: `webhookGuard(req, res, next)` — 404 se `!whatsappEnabled`; 404 se há `cf-ray` ou `cf-connecting-ip`; 401 se `x-webhook-secret` ausente ou diferente (`crypto.timingSafeEqual`, tratando tamanhos diferentes). `seenBefore(id: string, now?: number): boolean` — `false` na primeira vez, `true` nas seguintes por 10 min.

- [ ] **Step 1: Testes:** sem segredo → 401; segredo errado → 401; segredo certo → `next()`; com `cf-ray` (mesmo com segredo certo) → 404; módulo desligado → 404; `seenBefore('a')` → `false`, depois `true`; após 10 min + 1 ms (via `now`) → `false` de novo.
- [ ] **Step 2:** FAIL → implementar → PASS.
- [ ] **Step 3:** Em `app.ts`, **antes** do bloco `if (env.NODE_ENV === 'production')` do rate limit, montar `app.post('/api/whatsapp/webhook', express.json({ limit: '2mb' }), webhookGuard, whatsappWebhookController)`; por enquanto o controller é um stub que responde `200`.
- [ ] **Step 4:** Commit `feat(whatsapp): guarda do webhook e dedupe`.

---

### Task 5: Vínculo de conta (service + rotas)

**Files:**
- Create: `apps/backend/src/whatsapp/link.service.ts`, `link.routes.ts`, `__tests__/link.service.test.ts`
- Modify: `apps/backend/src/routes/index.ts` (`router.use('/whatsapp', whatsappLinkRoutes)`)

**Interfaces:**
- Produces (`link.service.ts`):
  - `createLinkCode(userId: number): Promise<{ code: string; expiresAt: Date }>` — apaga código anterior do usuário; `crypto.randomInt` de 6 dígitos com zeros à esquerda.
  - `consumeLinkCode(code: string, jid: string, phone: string | null): Promise<{ status: 'linked'; userId: number } | { status: 'invalid' } | { status: 'in_use' }>` — `invalid` se não existe/expirou; `in_use` se `jid`/`phone` já pertence a **outro** usuário; ao vincular, grava `whatsappJid`/`whatsappPhone` e apaga o código (uso único).
  - `findUserIdByJid(jid: string, phone: string | null): Promise<number | null>` — por `whatsappJid`; senão por `whatsappPhone ∈ phoneVariants(phone)`.
  - `unlink(userId: number): Promise<void>`; `getStatus(userId: number): Promise<{ linked: boolean; phone: string | null }>`.
- Produces (rotas, todas com `authenticate`): `POST /api/whatsapp/link-code` → `{ success: true, data: { code, expiresAt, botNumber } }`; `GET /api/whatsapp/status`; `DELETE /api/whatsapp/link`.

- [ ] **Step 1: Testes** com `prisma` mockado (`vi.mock('../../config/prisma')`): código válido vincula e o segundo uso do mesmo código dá `invalid`; código expirado → `invalid`; código inexistente → `invalid`; jid já vinculado a outro usuário → `in_use` e o código **não** é consumido para o usuário errado; `createLinkCode` substitui o anterior; `findUserIdByJid` acha por jid e, na falta, por variante do 9º dígito (`phone` sem o 9 encontra usuário salvo com o 9); `unlink` limpa os dois campos.
- [ ] **Step 2:** FAIL → implementar → PASS. Rotas: controller fino que chama o service com `req.userId!` (padrão de `settings.controller.ts`).
- [ ] **Step 3:** `npm run build --workspace=apps/backend`. Commit `feat(whatsapp): vínculo por código`.

---

### Task 6: Limites de uso

**Files:**
- Create: `apps/backend/src/whatsapp/usage.ts`, `__tests__/usage.test.ts`

**Interfaces:**
- Produces: `consume(userId: number, now?: number): { allowed: true } | { allowed: false; reason: 'window' | 'daily'; firstTime: boolean }` — 30 por janela deslizante de 10 min e `env.WHATSAPP_DAILY_LIMIT` por dia (virada à meia-noite de Brasília); `firstTime` é `true` só na primeira negativa do período, para o bot avisar uma vez. `allowUnknownReply(jid: string, now?: number): boolean` — no máximo 1 resposta por hora por remetente desconhecido. `allowLinkAttempt(jid: string, now?: number): boolean` — `false` se o `jid` tem ≥ 5 falhas na última hora ou o total global tem ≥ 50 falhas na última hora; `recordLinkFailure(jid: string, now?: number): void` registra uma falha de vínculo (janela deslizante de 1 h).

- [ ] **Step 1: Testes:** 30 chamadas permitidas e a 31ª negada com `reason:'window'`, `firstTime:true`, e a 32ª `firstTime:false`; após 10 min volta a permitir; teto diário configurado em 3 nega a 4ª com `reason:'daily'`; dia seguinte (BR) zera; `allowUnknownReply` → `true`, `false`, e `true` após 1 h; `allowLinkAttempt('a')` é `true` com 4 falhas registradas e `false` com 5 (e volta a `true` após 1 h); 50 falhas distribuídas entre jids diferentes tornam `allowLinkAttempt` falso para qualquer jid, inclusive um novo.
- [ ] **Step 2:** FAIL → implementar (Maps em memória) → PASS. Commit `feat(whatsapp): limites de uso`.

---

### Task 7: Formatação e atalhos sem IA

**Files:**
- Create: `apps/backend/src/whatsapp/format.ts`, `shortcuts.ts`, `__tests__/shortcuts.test.ts`

**Interfaces:**
- Produces: `formatBRL(n: number): string` (`1234.5` → `R$ 1.234,50`, via `Intl.NumberFormat('pt-BR')`); `normalizeText(s: string): string` (minúsculas, sem acentos/pontuação, espaços colapsados). `type Shortcut = 'saldo' | 'resumo' | 'ultimas' | 'orcamentos' | 'dividas' | 'ajuda' | 'sair' | 'sim' | 'nao'`; `matchShortcut(text: string, hasPending: boolean): Shortcut | null` — correspondência **exata** após normalizar (`'Saldo?'` → `saldo`; `'extrato'` → `ultimas`; `'ultimas'`; `'sim'`/`'nao'` só se `hasPending`; `'quanto gastei com comida'` → `null`); `runShortcut(userId: number, s: Exclude<Shortcut,'sim'|'nao'|'sair'>): Promise<string>` usando `dashboardService.getData` (saldo: `balance`; resumo: `balance`, `totalIncome`, `totalExpense` do mês), `transactionService.findAll(userId, { page: 1, limit: 5 })` (últimas), `budgetService.findAll` + `dashboardService.getData().budgetSummary` (orçamentos: nome, gasto/limite, %), `loanService.summary` (dívidas: `totalDebt`, próximos vencimentos).

- [ ] **Step 1: Testes** de `matchShortcut`/`normalizeText`/`formatBRL` conforme acima, incluindo `'sim'` sem pendência → `null`; `runShortcut('saldo')` com `dashboardService` mockado (`balance: 1234.5`) → resposta contém `R$ 1.234,50`.
- [ ] **Step 2:** FAIL → implementar → PASS. Commit `feat(whatsapp): atalhos sem IA`.

---

### Task 8: Cliente OpenAI

**Files:**
- Create: `apps/backend/src/whatsapp/llm.ts`, `__tests__/llm.test.ts`
- Modify: `apps/backend/package.json` (dependência `openai`)

**Interfaces:**
- Produces:
  ```ts
  export type LlmMessage =
    | { role: 'system' | 'user'; content: string }
    | { role: 'assistant'; content: string | null; toolCalls?: { id: string; name: string; arguments: string }[] }
    | { role: 'tool'; toolCallId: string; content: string };
  export interface ToolDef { name: string; description: string; parameters: Record<string, unknown> } // JSON Schema
  export interface LlmClient {
    transcribe(audio: Buffer): Promise<string>;
    complete(messages: LlmMessage[], tools: ToolDef[]): Promise<{ content: string | null; toolCalls: { id: string; name: string; arguments: string }[] }>;
  }
  export const openaiClient: LlmClient;
  ```
  `transcribe` envia o buffer como `audio.ogg` com `language: 'pt'` e `env.OPENAI_TRANSCRIBE_MODEL`; `complete` usa Chat Completions com `env.OPENAI_CHAT_MODEL`, convertendo de/para os tipos acima (não passar `temperature` — modelos da família gpt-5 rejeitam valores customizados).

- [ ] **Step 1:** `npm install openai --workspace=apps/backend` (avisar sobre o lockfile, ver Global Constraints).
- [ ] **Step 2: Testes** com o SDK mockado (`vi.mock('openai')`): `complete` converte `tool_calls` da resposta em `toolCalls`; converte mensagens `tool`/`assistant` com `toolCalls` para o formato do SDK; `transcribe` devolve o texto retornado e chama o modelo configurado.
- [ ] **Step 3:** FAIL → implementar → PASS. Commit `feat(whatsapp): cliente OpenAI`.

---

### Task 9: Conversa, ferramentas e agente

**Files:**
- Create: `apps/backend/src/whatsapp/conversation.ts`, `tools.ts`, `agent.ts`, `__tests__/tools.test.ts`, `__tests__/agent.test.ts`

**Interfaces:**
- Consumes: `LlmClient`, `LlmMessage`, `ToolDef` (Task 8); `formatBRL` (Task 7).
- Produces (`conversation.ts`): `type PendingTx = { type: 'INCOME' | 'EXPENSE'; amount: number; description: string; categoryId: number; categoryName: string; date: string /* YYYY-MM-DD */; expiresAt: number }`; `getHistory(userId: number): LlmMessage[]`; `appendHistory(userId: number, msgs: LlmMessage[]): void` (mantém as últimas 10; zera após 30 min sem uso); `setPending(userId: number, p: Omit<PendingTx,'expiresAt'>): void` (expira em 10 min); `getPending(userId: number): PendingTx | null` (nunca devolve expirada); `clearPending(userId: number): void`. Tudo indexado por `userId` (isolamento entre usuários).
- Produces (`tools.ts`): `buildTools(userId: number): { definitions: ToolDef[]; run(name: string, argsJson: string): Promise<string> }` com `propor_lancamento`, `confirmar_lancamento`, `cancelar_lancamento`, `consultar_resumo`, `consultar_transacoes`, `consultar_orcamentos`, `consultar_dividas` (parâmetros conforme o spec); `confirmPending(userId: number): Promise<string>` e `cancelPending(userId: number): string` (reutilizados pelo handler para "sim"/"não"). `propor_lancamento` valida com Zod (`amount` finito e > 0, `type` enum, `description` 1–255) e devolve texto de erro ao modelo se inválido — **nunca** grava; resolve categoria com fallback "Outros" → primeira → erro pedindo para criar uma; grava só via `confirmPending`, que chama `transactionService.create(userId, { ..., currency: 'BRL' })`. Texto de confirmação exato: `Lançar *despesa* de *R$ 47,00* em *Mercado* hoje? Responda *sim* ou *não*` (receita: `*receita*`; data diferente de hoje: `em dd/mm` no lugar de `hoje`).
- Produces (`agent.ts`): `runAgent(userId: number, userText: string, llm: LlmClient): Promise<string>` — prompt de sistema pt-BR com data de hoje (BR) e categorias do usuário (id + nome), regra de nunca criar lançamento sem confirmação e respostas curtas; carrega/atualiza o histórico; loop de no máximo 5 iterações executando as tool calls; se estourar, devolve a mensagem de erro padrão.

- [ ] **Step 1: Testes de `conversation`:** pendência expira após 10 min (relógio falso `vi.useFakeTimers`); usuário 1 não enxerga a pendência do usuário 2; histórico mantém só as 10 últimas.
- [ ] **Step 2: Testes de `tools`** (services e prisma mockados): `propor_lancamento` com `amount: 0`, `-50`, `'abc'` e `NaN` → texto de erro e `getPending` continua `null` e `transactionService.create` **não** é chamado; proposta válida de 47 em "Mercado" → pendente criada e texto de confirmação exato; categoria inexistente cai em "Outros", e sem "Outros" cai na primeira; usuário sem categorias → erro pedindo para criar; `confirmPending` sem pendência → `"Não há lançamento pendente."` sem chamar o service; com pendência → chama `transactionService.create` com `currency: 'BRL'` e limpa a pendência; `cancelPending` limpa; `confirmPending(2)` não confirma a pendência do usuário 1.
- [ ] **Step 3: Teste do agente** com `LlmClient` falso: resposta direta sem tool calls devolve o texto; uma tool call `consultar_resumo` seguida de texto → executa a ferramenta e devolve o texto final; 6 tool calls seguidas → devolve `Não consegui processar agora, tenta de novo em instantes.`; o `userId` usado nas ferramentas é sempre o recebido (nenhum argumento do modelo troca o usuário).
- [ ] **Step 4:** FAIL → implementar `conversation.ts`, `tools.ts`, `agent.ts` → PASS.
- [ ] **Step 5:** Commit `feat(whatsapp): conversa, ferramentas e agente`.

---

### Task 10: Handler e webhook controller

**Files:**
- Create: `apps/backend/src/whatsapp/handler.ts`, `webhook.controller.ts`, `__tests__/handler.test.ts`
- Modify: `apps/backend/src/app.ts` (trocar o stub da Task 4 pelo controller real)

**Interfaces:**
- Consumes: `WhatsappProvider`, `IncomingMessage` (Task 3); `LlmClient` (Task 8); `findUserIdByJid`, `consumeLinkCode` (Task 5); `consume`, `allowUnknownReply` (Task 6); `matchShortcut`, `runShortcut` (Task 7); `runAgent`, `confirmPending`, `cancelPending`, `getPending` (Task 9); `seenBefore` (Task 4).
- Produces: `handleIncoming(msg: IncomingMessage, deps: { provider: WhatsappProvider; llm: LlmClient }): Promise<void>` e `whatsappWebhookController(req, res)` (responde `200` imediatamente, chama `provider.parseWebhook` e `handleIncoming` sem aguardar; erros capturados e logados com Pino; em falha após identificar o usuário, envia `Não consegui processar agora, tenta de novo em instantes.`).

Ordem do `handleIncoming`: ignora `fromMe`, grupos e `seenBefore(msg.id)` → resolve o usuário (`findUserIdByJid`) → **não vinculado**: se o texto, aparado, bate `^\d{6}$`: se `!allowLinkAttempt(jid)` **silêncio total** (não chama `consumeLinkCode`, não responde); senão chama `consumeLinkCode` e, em `invalid` ou `in_use`, chama `recordLinkFailure(jid)` (`linked` → `✅ WhatsApp vinculado! Mande "ajuda" para ver o que posso fazer.`; `invalid` → `Código inválido ou expirado. Gere um novo no AppFin.`; `in_use` → `Este número já está vinculado a outra conta.`), senão, se `allowUnknownReply(jid)`, responde `Para usar, vincule seu número na página WhatsApp do AppFin.` → **vinculado**: `consume(userId)` (negado: avisa só se `firstTime`: `Muitas mensagens em pouco tempo. Tente de novo em alguns minutos.` / `Você atingiu o limite diário de mensagens. Volte amanhã.`) → `kind:'other'` responde `Só entendo texto e áudio.` → áudio com `audioSeconds > 120` responde `Áudio muito longo (máx. 2 min). Mande um mais curto.` → áudio: `getAudio` + `llm.transcribe`; transcrição vazia ou só espaços responde `Não entendi o áudio. Pode repetir?` e para → texto passa por `matchShortcut(text, getPending(userId) !== null)`: `sim` → `confirmPending`, `nao` → `cancelPending`, `sair` → `unlink` + `Número desvinculado.`, `ajuda` → lista curta de exemplos, demais atalhos → `runShortcut`; sem atalho → `runAgent`. Para áudio, se após o agente existir pendência, prefixar a resposta com `🎙️ Entendi: "<transcrição>"\n\n`. "sim" sem pendência não chega ao `confirmPending` pelo atalho (retorna `null`): cai no agente, que responde sem gravar.

- [ ] **Step 1: Testes** (provider e llm falsos, services mockados): mensagem `fromMe` / de grupo / com `id` repetido → nada é enviado nem processado; remetente desconhecido com texto `483920` e código válido → vincula e responde confirmação; código inválido → `Código inválido ou expirado. Gere um novo no AppFin.`; remetente desconhecido que já falhou 5 vezes manda agora um código **válido** → `consumeLinkCode` não é chamado e nada é enviado; desconhecido com outro texto → instrução uma vez e, na segunda mensagem em 1 h, silêncio; vinculado mandando `saldo` → `runAgent` **não** é chamado; `sim` com pendência → `transactionService.create` chamado uma vez; `sim` sem pendência → nenhuma gravação; áudio de 130 s → resposta de áudio muito longo e `transcribe` não chamado; áudio com transcrição `'   '` → `Não entendi o áudio. Pode repetir?` e `runAgent` não chamado; `kind:'other'` → `Só entendo texto e áudio.`; exceção no agente → mensagem de erro padrão enviada.
- [ ] **Step 2:** FAIL → implementar → PASS; trocar o stub em `app.ts`.
- [ ] **Step 3:** `npm test --workspace=apps/backend` e `npm run build --workspace=apps/backend` → tudo verde. Commit `feat(whatsapp): handler e webhook`.

---

### Task 11: Frontend — página de vínculo

**Files:**
- Create: `apps/frontend/src/hooks/useWhatsapp.ts`, `apps/frontend/src/app/(dashboard)/whatsapp/page.tsx`
- Modify: `apps/frontend/src/lib/api.ts` (grupo `whatsapp`), `components/layout/Sidebar.tsx` (item `{ href: '/whatsapp', label: 'WhatsApp', icon: MessageCircle }` no grupo de Relatórios/Calculadora), `components/layout/Header.tsx` (`pathLabels['/whatsapp'] = 'WhatsApp'`)

**Interfaces:**
- Consumes: `POST /api/whatsapp/link-code`, `GET /api/whatsapp/status`, `DELETE /api/whatsapp/link` (Task 5).
- Produces: `api.whatsapp.{ status(), createLinkCode(), unlink() }`; hooks `useWhatsappStatus()`, `useCreateLinkCode()`, `useUnlinkWhatsapp()` no padrão de `useSettings.ts` (React Query, invalida `['whatsapp']`).

- [ ] **Step 1:** Implementar api/hooks. Página (padrão visual das demais com shadcn/ui): estado **vinculado** (mostra o número mascarado e botão "Desvincular") ou **não vinculado** (aviso de privacidade — "as mensagens e os dados consultados são processados pela OpenAI" —, checkbox de aceite que habilita o botão "Gerar código"; ao gerar, mostra o código, contagem de expiração de 10 min e botão/link `https://wa.me/<botNumber>?text=<code>`); mostra os exemplos de uso ("gastei 47 no mercado", "quanto gastei esse mês?", áudio funciona igual).
- [ ] **Step 2:** `npx tsc --noEmit -p apps/frontend` → sem erro; subir o app (skill `run`) e conferir no navegador, em largura mobile e desktop, os dois estados e o item na sidebar.
- [ ] **Step 3:** Commit `feat(whatsapp): página de vínculo no frontend`.

---

### Task 12: Infra, runbook e deploy

**Files:**
- Modify: `docker-compose.yml` (serviço `evolution`, volume `evolution_instances`, envs novas no `backend`)
- Create: `docs/whatsapp-setup.md`

- [ ] **Step 1:** Fixar a versão da imagem `evoapicloud/evolution-api` conferindo a documentação atual (e o formato do payload `messages.upsert`; se divergir do que a Task 3 assumiu, ajustar os testes/parser lá). Serviço `evolution`: `restart: unless-stopped`, `depends_on: postgres (service_healthy)`, `DATABASE_PROVIDER=postgresql`, `DATABASE_CONNECTION_URI` apontando para o banco `evolution` no serviço `postgres` existente, `CACHE_REDIS_ENABLED=false`, `CACHE_LOCAL_ENABLED=true`, `AUTHENTICATION_API_KEY=${EVOLUTION_API_KEY}`, `ports: ["127.0.0.1:8080:8080"]`, volume `evolution_instances`, limite de memória 640M. Backend recebe `EVOLUTION_API_URL=http://evolution:8080`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WHATSAPP_WEBHOOK_SECRET`, `WHATSAPP_BOT_NUMBER`, `OPENAI_*`, `WHATSAPP_DAILY_LIMIT`. `docker compose config` valida sem erro e **não** cria segundo Postgres nem monta `pgdata` em outro serviço.
- [ ] **Step 2:** Escrever `docs/whatsapp-setup.md` com o runbook: gerar segredos (`openssl rand -hex 32`), `CREATE DATABASE evolution` via `docker exec finance_postgres psql -U finance -c "CREATE DATABASE evolution"`, criar a instância e ler o QR code via túnel SSH (`ssh -L 8080:localhost:8080 ops@192.168.15.2`), registrar o webhook na instância (`http://backend:3001/api/whatsapp/webhook`, evento `MESSAGES_UPSERT`, header `x-webhook-secret`), rollback (remover envs `EVOLUTION_*` desliga o módulo) e como trocar de número.
- [ ] **Step 3 (com confirmação do usuário a cada ação no servidor):** no servidor `ops@192.168.15.2` (`~/finance-app`): `pg_dump` do banco para `~/pg-backups/` antes de qualquer coisa; liberar disco com `docker builder prune -af` (16 GB de cache; só após o usuário confirmar); preencher o `.env`; `git pull` da `stable` (após merge da branch `feat/whatsapp`); `docker compose up -d --build`; confirmar como as migrations são aplicadas (CMD do `apps/backend/Dockerfile`) e que `add_whatsapp` foi aplicada; `docker ps` com os 4 containers saudáveis e `GET /api/health` → 200.
- [ ] **Step 4:** Teste ponta a ponta com o número real do bot: vincular pelo app; enviar `saldo` (sem IA); `gastei 47 no mercado` → confirmação → `sim` → conferir a transação no app; mesmo pedido por áudio; `quanto gastei com mercado esse mês?`; mensagem de um número não vinculado recebe a instrução; `POST` ao webhook pelo domínio público (`api-finance.walker.dev.br`) → 404.
- [ ] **Step 5:** Commit `feat(whatsapp): compose da Evolution e runbook`.
