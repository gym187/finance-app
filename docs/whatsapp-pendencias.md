# WhatsApp — pendências e próximos passos

Estado em 2026-11-21: tudo está implementado e revisado na branch local `feat/whatsapp` (não foi feito merge, push nem deploy). Backend com 227 testes passando, build do backend e typecheck do frontend ok.

Documentos relacionados:
- Design: `docs/superpowers/specs/2026-11-21-whatsapp-assistente-design.md`
- Plano: `docs/superpowers/plans/2026-11-21-whatsapp-assistente.md`
- Runbook de instalação e operação: `docs/whatsapp-setup.md`

---

## 1. Antes do merge

- [ ] **Ver a página `/whatsapp` no navegador** (nunca foi aberta; não havia backend nem banco locais).
  - Celular (320–375 px) e desktop.
  - Tema claro e escuro.
  - Item "WhatsApp" na sidebar.
  - Estado não vinculado: aviso de privacidade, checkbox, gerar código, contagem regressiva, expiração, link `wa.me`.
  - Estado vinculado: número mascarado, diálogo de desvincular.
  - Mensagem de erro quando a API falha.
- [ ] **Decidir como integrar a branch:** merge local na `stable`, PR, ou manter como está.
- [ ] **Conferir o commit do `package-lock.json`.** Ele inclui uma alteração sua de 1 linha que já estava sem commit e não foi possível separar. Se não quiser, reverta esse commit e regenere o lockfile.
- [ ] **Decidir sobre o Node:** o `openai` foi fixado em `^6.49.0` porque a versão 7 exige Node 22 e a imagem do backend e o CI usam Node 20. Alternativa: subir o Node para 22 nas imagens e no CI.

## 2. Preparar insumos

- [ ] Chip ou eSIM novo, **dedicado ao bot** (não pode ser o seu número pessoal).
- [ ] Chave da OpenAI (`OPENAI_API_KEY`).
- [ ] Gerar os segredos (instruções no runbook, seção 1): `EVOLUTION_API_KEY` (64 hex), `WHATSAPP_WEBHOOK_SECRET`, `EVOLUTION_DB_PASSWORD`.

## 3. Deploy no servidor (192.168.15.2) — cada passo precisa da sua autorização

Seguir `docs/whatsapp-setup.md`. Resumo da ordem:

- [ ] Backup do banco: `pg_dump` em `~/pg-backups/`.
- [ ] Confirmar com `docker ps` que existe **exatamente um** container Postgres. Nunca subir outro compose usando o volume `pgdata` (incidente de 17/11/2026).
- [ ] Opcional: `docker builder prune -af` (libera ~16 GB de cache de build; o disco está em ~81%).
- [ ] Atualizar o código na `stable` e preencher o `.env` (variáveis novas no `.env.example`).
- [ ] Criar o usuário e o banco da Evolution (`CREATE ROLE evolution ...; CREATE DATABASE evolution OWNER evolution;`), conforme runbook seção 3.
- [ ] Conferir que `EVOLUTION_API_KEY` tem 64 hex: `grep -cE '^EVOLUTION_API_KEY=[0-9a-f]{64}$' .env` deve imprimir `1` (com a chave vazia, a Evolution cai numa chave de exemplo conhecida).
- [ ] Ligar o perfil (`COMPOSE_PROFILES=whatsapp` no `.env`) e `docker compose up -d --build`, **acompanhando `docker logs`** no primeiro start.
- [ ] Confirmar que a migration `20261121000000_add_whatsapp` foi aplicada e que `GET /api/health` responde 200.
- [ ] Criar a instância e ler o QR code com o chip novo (túnel SSH `ssh -L 8080:localhost:8080 ops@192.168.15.2`).
- [ ] Registrar o webhook na instância: `http://backend:3001/api/whatsapp/webhook`, evento `MESSAGES_UPSERT`, header `x-webhook-secret`.

## 4. Teste de ponta a ponta com o número real

- [ ] Gerar o código em `/whatsapp`, enviar ao bot e ver a página virar "vinculado".
- [ ] `saldo`, `resumo`, `últimas` (respostas sem IA).
- [ ] `gastei 47 no mercado` → confirmação → `sim` → conferir a transação no app.
- [ ] O mesmo pedido por **áudio**.
- [ ] Consulta livre: `quanto gastei com mercado esse mês?`.
- [ ] Número não vinculado: recebe só a instrução de como vincular.
- [ ] Conferir que um `POST` ao webhook pelo domínio público (`api-finance.walker.dev.br`) devolve 404.
- [ ] Testar também: uma reação a uma mensagem, uma conversa com mensagens temporárias ligadas, e garantir que nunca há resposta para `status@broadcast`.
- [ ] Conferir nos logs que não aparecem texto de mensagens, códigos, telefones nem o segredo do webhook.

## 5. O que ainda não foi verificado

- Formato real das respostas da Evolution ao criar instância, ler o QR e enviar mensagem para `@lid` (vem da leitura do código-fonte da versão 2.3.7).
- Migrations da Evolution rodando com o usuário `evolution` (sem superusuário) e a instância funcionando com `MESSAGE_UPDATE`, `CONTACTS` e `CHATS` desligados.
- Download de áudio dentro de mensagens temporárias ou de visualização única.
- Modelo de transcrição: `gpt-4o-mini-transcribe` aparece como descontinuado em 2027-02-26 em fontes de terceiros (a página oficial não confirmou). O nome do substituto (`gpt-transcribe`) não foi verificado. Conferir a página de descontinuações da OpenAI antes dessa data; a troca é só a variável `OPENAI_TRANSCRIBE_MODEL`.

## 6. Melhorias adiadas (não bloqueiam)

Produto:
- A página e as rotas de vínculo ficam ativas mesmo com o módulo desligado; mostrar "indisponível" quando o módulo estiver off.
- Incluir a descrição do lançamento no texto de confirmação.
- Resposta para o caso de duas intenções na mesma mensagem (hoje só a confirmação do lançamento é enviada).
- Avisar que uma proposta anterior foi substituída por uma nova.
- Tratar o erro de consulta de status na página (hoje um usuário vinculado pode ver "Vincular" se a consulta falhar).

Segurança e operação:
- Senha do usuário `evolution` passada por `-v pw=` na linha de comando do `docker exec` (fica visível por instantes no `ps`); passar por stdin.
- Receita para o servidor onde um banco `evolution` já existir criado pelo superusuário (hoje o runbook só manda parar e tratar manualmente).
- Healthcheck do container da Evolution.
- Limite global de 50 falhas de vínculo por hora: quem tiver vários números pode bloquear novos vínculos por 1 hora (aceito como trade-off, documentado).
- Estado de conversa e pendências ficam em memória: um restart do backend apaga o histórico e confirmações pendentes.

Fora do escopo desta feature, mas observado na revisão:
- O Postgres publica a porta 5432 em todas as interfaces do servidor, e a senha padrão do compose é `finance123`.
- O CI não tem job de testes e roda em `main`, enquanto o deploy sai da `stable`.
- O build do Docker usa `npm install` sem o lockfile.

## 7. Rollback

- **Desligar o módulo:** esvaziar `WHATSAPP_WEBHOOK_SECRET` (basta isso para a rota do webhook responder 404), remover `whatsapp` de `COMPOSE_PROFILES` e `docker compose --profile whatsapp rm -sf evolution`. Manter `EVOLUTION_API_KEY` preenchida.
- **Voltar o código:** voltar para a versão anterior da `stable` é seguro, porque a migration só adiciona colunas e uma tabela, que ficam sem uso.
- Detalhes no runbook.
