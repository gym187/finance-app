# Assistente financeiro no WhatsApp — Design

Data: 2026-11-21 · Status: rascunho para aprovação

## Intenção

O AppFin é (ou será) usado por várias pessoas, não só pelo dono. O dono quer que **cada usuário** possa lançar transações e consultar suas próprias finanças no AppFin pelo WhatsApp, porque é o app que já usa no dia a dia ("pela facilidade"). Deve funcionar tanto com **mensagem de texto** quanto com **áudio**, entendendo linguagem natural em pt-BR, usando a API da OpenAI com modelos baratos.

## Objetivos

- Receber texto e áudio no WhatsApp e responder no mesmo chat.
- **Lançamentos:** criar despesa/receita a partir de frases como "gastei 47 no mercado" ou um áudio equivalente.
- **Consultas:** responder perguntas como "qual meu saldo?", "quanto gastei com alimentação esse mês?", "últimos lançamentos", "como estão meus orçamentos?", "quanto devo nas dívidas?".
- Confirmar antes de gravar qualquer lançamento.
- Custo de IA desprezível (< US$ 1/mês em uso pessoal).

## Não-objetivos

- Cada usuário usar o próprio número de bot (um único número compartilhado atende todos).
- Cobrança ou planos pelo uso do WhatsApp.
- Telegram: não é tocado (continua como está; remoção seria tarefa separada).
- Editar/excluir transações pelo WhatsApp (v1 só cria e consulta).
- Notificações proativas (alertas de orçamento, dívida vencendo) pelo WhatsApp.
- Responder com áudio (respostas são sempre texto).
- Grupos do WhatsApp — só conversas individuais.
- Multi-moeda pelo chat (lançamentos em BRL).

## Anti-objetivos (seria fracasso mesmo funcionando)

- Gravar lançamento errado sem o usuário ver/confirmar.
- Um usuário ver ou alterar dados de outro (toda ferramenta recebe o `userId` do remetente vinculado, nunca um id vindo do modelo), ou alguém vincular o número de outra pessoa.
- Derrubar ou corromper o Postgres de produção (ver incidente de 17/11/2026: nunca duas instâncias no mesmo volume).
- Expor o webhook ou a Evolution API na internet sem necessidade.

## Restrições

- Servidor de produção: 192.168.15.2, Docker Compose (`docker-compose.yml`), 3,8 GB RAM, disco ~81% (16 GB de build cache liberável com `docker builder prune -af` — fazer antes do deploy).
- Fuso horário sempre America/Sao_Paulo (UTC-3) para datas de lançamento e "este mês".
- Backend: Express 4 + TypeScript + Prisma 5 + Zod; lógica de negócio fica em `apps/backend/src/services/*` (todos recebem `userId`).
- Modelos da OpenAI mudam/descontinuam rápido: nomes devem ser configuráveis por env.
- WhatsApp não oficial (Evolution API/Baileys) pode banir o número; uso pessoal e baixo volume minimizam o risco. O bot usa um **número dedicado** (o usuário vai providenciar).

## Abordagens consideradas

| | Abordagem | Prós | Contras |
|---|---|---|---|
| **A (escolhida)** | Módulo dentro do backend; Evolution API envia webhook para o backend pela rede Docker interna | Reaproveita services e Prisma; um container a mais (a Evolution) | Bug grave no módulo pode afetar o backend |
| B | Serviço separado `apps/whatsapp-bot` chamando a API REST | Isolamento | Precisa autenticar como usuário (JWT/CSRF), duplica lógica; mais trabalho sem ganho real |
| C | Fluxo no n8n | Pouco código | Lógica fora do repo, sem testes/versão; mais um serviço pesado num servidor com disco apertado |

Canal: **Evolution API (não oficial)** escolhida em vez da Cloud API oficial da Meta pela facilidade (sem conta Business/verificação/templates).

IA: **pipeline de dois modelos** (transcrição → modelo de texto com tool calling) em vez de um modelo de áudio "tudo em um" (`gpt-audio-mini`), porque este está marcado como descontinuado, não suporta structured outputs e tem preço de áudio incerto. Texto e áudio passam pelo mesmo caminho.

## Design

### Visão geral do fluxo

```
WhatsApp (usuário) ──► número do bot ──► Evolution API (container)
                                              │ webhook MESSAGES_UPSERT (rede Docker interna)
                                              ▼
                              backend: POST /api/whatsapp/webhook
                                              │ 1. valida segredo do webhook
                                              │ 2. ignora: fromMe, grupos, número não vinculado
                                              │ 3. áudio? baixa base64 da Evolution → transcrição OpenAI
                                              │ 4. texto → agente (OpenAI tool calling) com contexto da conversa
                                              │ 5. ferramentas chamam services existentes com userId
                                              ▼
                              Evolution API sendText ──► resposta no WhatsApp
```

O webhook responde `200` imediatamente e processa de forma assíncrona (a Evolution não deve ficar esperando a OpenAI).

### Infraestrutura

- Novo serviço `evolution` no `docker-compose.yml` (imagem oficial `evoapicloud/evolution-api` em versão fixa), **sem porta publicada na internet**; porta 8080 publicada só em `127.0.0.1` para o usuário abrir o manager e ler o QR code via túnel SSH (`ssh -L 8080:localhost:8080 ops@192.168.15.2`).
- Persistência da Evolution em um **banco separado (`evolution`) dentro do mesmo container `finance_postgres`** — mesma instância, não uma segunda instância no volume. Criado via script de init/one-off `CREATE DATABASE evolution`. Cache em memória local (sem Redis).
- Volume próprio `evolution_instances` para os arquivos de sessão.
- Webhook configurado na instância apontando para `http://backend:3001/api/whatsapp/webhook`, evento `MESSAGES_UPSERT`, com header de autenticação contendo `WHATSAPP_WEBHOOK_SECRET`.
- **Atenção:** o backend publica `3001:3001` e o túnel Cloudflare aponta `api-finance.walker.dev.br` para ele, então a rota do webhook fica alcançável pela internet. Defesa em duas camadas: (1) segredo no header, comparado em tempo constante; (2) middleware que responde 404 a qualquer requisição com header `cf-ray`/`cf-connecting-ip` nessa rota (tráfego do túnel sempre os carrega; o da Evolution pela rede Docker não). A rota fica fora do rate limit global por IP.
- Novas env vars do backend (todas opcionais; sem elas o módulo fica desligado, como o Telegram):
  - `EVOLUTION_API_URL` (ex.: `http://evolution:8080`), `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`
  - `WHATSAPP_WEBHOOK_SECRET`
  - `OPENAI_API_KEY`
  - `OPENAI_TRANSCRIBE_MODEL` (padrão: modelo de transcrição barato vigente — confirmar na página oficial de preços na implementação; candidatos `gpt-transcribe` / `gpt-4o-mini-transcribe`)
  - `OPENAI_CHAT_MODEL` (padrão `gpt-5-nano`; fallback recomendado `gpt-5-mini` se o nano errar tool calls)

### Vínculo de conta (por código de verificação)

O app tem cadastro aberto e vários usuários, então o número do WhatsApp **precisa ser provado**, não apenas digitado. Todos os usuários conversam com o **mesmo número de bot**.

- Novo campo `User.whatsappPhone String? @unique` (dígitos, ex.: `5511999998888`) e nova tabela `WhatsappLinkCode` (`userId`, `code` de 6 dígitos, `expiresAt` em 10 min, uso único; no máximo 1 ativo por usuário).
- Fluxo: em **Configurações → WhatsApp**, o usuário clica em "Vincular" e o app mostra um código e o número do bot (com link `wa.me/<bot>?text=<código>`). O usuário envia o código ao bot. O webhook reconhece o código, grava o remetente em `whatsappPhone` e responde confirmando. Só o dono do número consegue enviar a partir dele, então o vínculo é provado.
- Quem envia um código inválido/expirado recebe uma resposta curta de erro; número **não vinculado que manda qualquer outra coisa** recebe uma única instrução: "Para usar, vincule seu número em Configurações do AppFin." (necessário agora que o bot é público para os usuários; limitado por rate limit por remetente).
- O remetente é identificado pelo JID. Se a Evolution entregar `@lid` em vez do telefone, o vínculo guarda o identificador efetivamente recebido (campo `whatsappJid` além do telefone) — o código de verificação torna isso viável sem depender do telefone. Conferir o formato do payload na implementação.
- Tratar a variação do 9º dígito brasileiro ao comparar telefones.
- Desvincular: botão em Configurações (limpa `whatsappPhone`); também comando "sair" no chat.
- Rotas autenticadas (CSRF como as demais): `POST /api/whatsapp/link-code`, `DELETE /api/whatsapp/link`, `GET /api/whatsapp/status`.

### Agente (OpenAI)

- Módulo `apps/backend/src/whatsapp/`:
  - `whatsapp.routes.ts` / controller — webhook.
  - `provider.ts` — interface `WhatsappProvider` (`sendText`, `getAudio`, `parseWebhook`) e `evolution.provider.ts` como única implementação na v1. O agente e o webhook só conhecem a interface, para permitir trocar depois pela Cloud API oficial da Meta sem reescrever o resto.
  - `shortcuts.ts` — atalhos sem IA (ver abaixo).
  - `openai.client.ts` — `transcribe(audioBuffer)`, `chat(messages, tools)` via SDK oficial `openai`.
  - `agent.ts` — monta prompt, executa loop de tool calling (máx. ~5 iterações), devolve texto final.
  - `tools.ts` — definições + implementações das ferramentas.
  - `conversation.ts` — histórico curto por usuário.
- System prompt (pt-BR): assistente financeiro do AppFin; data/hora atual em America/Sao_Paulo; lista de categorias do usuário (nome + id); regras: respostas curtas, valores em R$ formato brasileiro, **nunca criar lançamento sem confirmação explícita**, se faltar valor perguntar.
- **Ferramentas (v1):**
  - `propor_lancamento({type, amount, description, categoryId?, date?})` — não grava; guarda como pendente na conversa e o modelo pede confirmação ("Lançar *despesa* de *R$ 47,00* em *Mercado* hoje? Responda *sim* ou *não*").
  - `confirmar_lancamento()` — grava o pendente via `transactionService.create(userId, ...)` (dispara alertas de orçamento como hoje, se o service já fizer isso).
  - `cancelar_lancamento()`
  - `consultar_resumo()` — saldo/receitas/despesas do mês via `dashboardService.getData`.
  - `consultar_transacoes({startDate?, endDate?, type?, categoryId?, limit?})` — via `transactionService.findAll` (total + últimos itens).
  - `consultar_orcamentos()` — via `budgetService.findAll`.
  - `consultar_dividas()` — via `loanService.summary`.
- Categoria: `Transaction.categoryId` é obrigatório no schema, então não existe lançamento sem categoria. O modelo escolhe da lista do usuário; se nenhuma servir, usa "Outros" ou, na falta dela, a primeira categoria (mesmo fallback do bot do Telegram). Se o usuário não tiver nenhuma categoria, o bot pede para criar uma no app. Nunca cria categoria nova automaticamente.
- O pendente fica em memória por usuário e expira em 10 min.

### Atalhos sem IA

Antes de chamar a OpenAI, o texto (já normalizado: minúsculas, sem acento/pontuação) é comparado com um conjunto pequeno de comandos exatos: `saldo`, `resumo`, `ultimas`/`extrato`, `orcamentos`, `dividas`, `ajuda`, `sair`, e `sim`/`nao` quando há lançamento pendente. Esses são respondidos direto pelos services, sem custo de IA e com resposta quase instantânea. Qualquer outra coisa segue para o agente. O texto vindo de áudio também passa pelos atalhos depois de transcrito.

### Histórico da conversa

- Em memória (Map por userId, isolado entre usuários), últimas ~10 mensagens, expira após 30 min sem atividade. Reiniciar o backend perde o contexto — aceitável para v1.

### Áudio

- Mensagens `audioMessage` (incluindo PTT): baixar base64 pela Evolution (`getBase64FromMediaMessage`), enviar à transcrição como arquivo `.ogg`. Limite: áudios > 2 min recebem resposta pedindo algo mais curto (controle de custo).
- A resposta pode ecoar a transcrição de forma curta quando houver lançamento ("🎙️ Entendi: 'gastei 47 no mercado'").

### Erros e limites

- Falha da OpenAI/Evolution: responder "Não consegui processar agora, tenta de novo em instantes." e logar com Pino.
- Mensagens de tipos não suportados (imagem, figurinha, documento): resposta curta dizendo que só entende texto e áudio.
- Rate limit por usuário (ex.: 30 mensagens/10 min) e teto diário de mensagens por usuário, pois o custo da OpenAI é pago pelo dono para todos. Quando o teto é atingido, o bot avisa uma vez e para de processar até o dia seguinte.
- Idempotência: ignorar `message.key.id` já processado (Set em memória com TTL) — a Evolution pode reenviar webhook.

### Testes

O backend não tem suíte de testes hoje. Para este módulo: adicionar Vitest no backend e cobrir as partes puras — normalização de telefone (incl. 9º dígito), filtragem de mensagens do webhook (fromMe/grupo/tipo), parsing do payload da Evolution, e as ferramentas com services mockados. Cliente OpenAI e Evolution mockados; teste manual end-to-end em produção com o número real.

## Decidido pelo usuário

- O recurso é para todos os usuários do app (multiusuário), com vínculo por código de verificação.
- Canal WhatsApp, foco total nele; Telegram fica de fora.
- Evolution API (não oficial) com número dedicado.
- OpenAI, modelos baratos, texto e áudio, lançamentos e consultas.
- Abordagem A (módulo no backend).

## Privacidade e risco multiusuário

- O texto/áudio dos usuários e os dados financeiros consultados passam pela OpenAI. Avisar isso na tela de vínculo e aceitar no ato de vincular.
- Mais usuários num único número não oficial aumentam o risco de banimento do número. Mitigação: só responder a quem vinculou (e a uma instrução por remetente desconhecido), nunca iniciar conversa, ritmo moderado de respostas. Se o número cair, o recurso fica fora até reconectar outro número.

## Chamadas minhas (revisáveis)

- Pipeline transcrição + `gpt-5-nano` (configurável), não modelo de áudio único.
- Evolution API na v1, mas atrás da interface `WhatsappProvider`, para migrar para a API oficial da Meta se o número for banido ou o uso crescer.
- Atalhos sem IA para consultas simples (custo e latência).
- Confirmação por resposta de texto "sim/não" (sem botões — botões interativos são instáveis na API não oficial).
- Número não vinculado recebe uma única instrução de como vincular (não é ignorado, pois o bot é público para os usuários).
- Histórico e pendências em memória (sem Redis).
- Banco `evolution` na mesma instância Postgres.
- Limite de 2 min por áudio e rate limit por usuário.
- Sem criação automática de categoria (fallback "Outros"/primeira, como no Telegram); sem edição/exclusão na v1.
- Proteção do webhook: segredo + bloqueio de tráfego vindo do Cloudflare (o webhook não é realmente interno).

## Deixado para quem implementar

- Versão exata da imagem da Evolution e o formato preciso do payload v2 (conferir na doc).
- Modelo de transcrição vigente e preço (conferir página oficial da OpenAI).
- Texto exato do system prompt e das mensagens.
