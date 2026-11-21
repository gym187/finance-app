# Assistente WhatsApp — runbook de setup e deploy

Este documento e para o operador. Tudo que toca o servidor de producao (`ops@192.168.15.2`, `~/finance-app`) e MANUAL e deve ser feito com confirmacao explicita, uma acao por vez.

Arquitetura: o app conversa com o WhatsApp via **Evolution API v2** (container `finance_evolution`, imagem `evoapicloud/evolution-api:v2.3.7`, fixada, nunca `latest`). A Evolution guarda seus dados no banco `evolution` **dentro do Postgres existente** (`finance_postgres`). A Evolution chama o backend em `POST http://backend:3001/api/whatsapp/webhook`; o backend responde via `POST /message/sendText/{instance}`.

> REGRA DURA: nunca criar um segundo servico Postgres nem montar o volume `pgdata` em outro servico (incidente de corrupcao de 2026-11-17). A Evolution usa apenas um banco separado no Postgres que ja existe.

## 0. Checklist ANTES do deploy (producao)

1. `docker ps` deve mostrar **exatamente um** container postgres (`finance_postgres`). Se houver mais de um, PARE.
2. Backup do banco:
   ```bash
   mkdir -p ~/pg-backups
   docker exec finance_postgres pg_dump -U finance financedb | gzip > ~/pg-backups/financedb-$(date +%Y%m%d-%H%M).sql.gz
   ls -lh ~/pg-backups/
   ```
   (use os valores reais de `POSTGRES_USER`/`POSTGRES_DB` do `.env` se forem diferentes de `finance`/`financedb`).
3. Disco: o cache de build ocupa ~16 GB. `docker builder prune -af` libera esse espaco; e destrutivo SO para o cache de build (imagens, containers e volumes nao sao afetados), mas so rode com OK do operador. Confira antes com `df -h` e `docker system df`.
4. Merge de `feat/whatsapp` na `stable` e `git pull` no servidor (manual).

## 1. Gerar segredos

```bash
openssl rand -hex 32   # EVOLUTION_API_KEY
openssl rand -hex 32   # WHATSAPP_WEBHOOK_SECRET
```

## 2. Variaveis no `.env` do servidor (nunca commitar)

```env
EVOLUTION_API_KEY=<segredo 1>
EVOLUTION_INSTANCE=appfin
WHATSAPP_WEBHOOK_SECRET=<segredo 2>
WHATSAPP_BOT_NUMBER=55DDDNUMERODOBOT   # so digitos, com DDI, ex.: 5511999998888
OPENAI_API_KEY=sk-...
COMPOSE_PROFILES=whatsapp   # habilita o servico evolution (veja abaixo)
# opcionais (ja tem default no compose):
# EVOLUTION_API_URL=http://evolution:8080
# WHATSAPP_DAILY_LIMIT=100
# OPENAI_CHAT_MODEL=gpt-5-nano
# OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

**Profile `whatsapp`:** o servico `evolution` esta sob `profiles: ["whatsapp"]`, entao um `docker compose up -d` comum NAO o sobe. Habilite com `COMPOSE_PROFILES=whatsapp` no `.env` (preferido: deploys futuros mantem a Evolution rodando) ou use `docker compose --profile whatsapp up -d`. `EVOLUTION_API_KEY` deve ser SEMPRE um valor aleatorio forte (>= 32 caracteres hex) quando o profile estiver ativo. Esvaziar `EVOLUTION_API_URL` no `.env` nao faz nada: o default `:-http://evolution:8080` do compose preenche de volta.

O modulo so liga se os cinco obrigatorios (`EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `WHATSAPP_WEBHOOK_SECRET`, `OPENAI_API_KEY`) estiverem preenchidos (`WHATSAPP_BOT_NUMBER` nao e obrigatorio para ligar o modulo, mas configure-o); caso contrario o backend sobe normalmente com o WhatsApp desativado.

Se `POSTGRES_PASSWORD` tiver caracteres especiais (`@ : / ? #`), a connection string da Evolution quebra: use uma senha so com letras/numeros.

Nota `OPENAI_TRANSCRIBE_MODEL`: `gpt-4o-mini-transcribe` e reportado como descontinuado em 2027-02-26 por rastreadores de terceiros (nao confirmado na pagina oficial); o nome substituto `gpt-transcribe` NAO foi verificado. Consulte a pagina de deprecations da OpenAI antes dessa data e ajuste a variavel.

## 3. Criar o banco `evolution` (uma unica vez)

O Postgres precisa estar de pe. O banco `evolution` NAO e criado automaticamente:

```bash
docker exec finance_postgres psql -U finance -d postgres -c "CREATE DATABASE evolution"
```
(`-U` deve ser o valor de `POSTGRES_USER` do `.env`; padrao `finance`. O `-d postgres` e obrigatorio: sem ele o psql tenta o banco `finance`, que nao existe, e falha com `database "finance" does not exist`.)

ATENCAO: se a Evolution subir ANTES deste `CREATE DATABASE`, ela entra em loop de restart. Recuperacao: crie o banco e rode `docker compose restart evolution`. Conferir: `docker exec finance_postgres psql -U finance -d postgres -l | grep evolution`. A Evolution cria o schema `evolution_api` e roda as migrations sozinha ao subir.

## 4. Subir

```bash
cd ~/finance-app
docker compose up -d --build   # com COMPOSE_PROFILES=whatsapp no .env (ou --profile whatsapp)
docker ps                       # 4 containers: postgres, backend, frontend, evolution
docker logs -f finance_evolution
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/api/health   # 200
```
Confirme tambem que a migration `add_whatsapp` foi aplicada (veja o CMD de `apps/backend/Dockerfile`).

## 5. Criar a instancia e ler o QR code

A porta 8080 da Evolution esta somente em loopback (`127.0.0.1:8080`). Do seu computador, abra um tunel SSH:

```bash
ssh -L 8080:localhost:8080 ops@192.168.15.2
```
Em outro terminal (local), com a chave `EVOLUTION_API_KEY` do `.env`:

```bash
read -rs EVO_KEY   # cola a EVOLUTION_API_KEY (nao aparece no historico); depois: export EVO_KEY
curl -s -X POST http://localhost:8080/instance/create \
  -H "apikey: $EVO_KEY" -H "Content-Type: application/json" \
  -d '{"instanceName":"appfin","qrcode":true,"integration":"WHATSAPP-BAILEYS"}'
```
O nome da instancia deve ser igual a `EVOLUTION_INSTANCE`. A resposta traz o QR (`qrcode.base64`). Alternativas: abrir o manager em `http://localhost:8080/manager` pelo tunel, ou buscar o QR de novo com:

```bash
curl -s http://localhost:8080/instance/connect/appfin -H "apikey: $EVO_KEY"
```
Escaneie o QR no WhatsApp do **segundo numero** (o numero do bot, nao o seu pessoal): no celular desse numero, WhatsApp > Aparelhos conectados > Conectar um aparelho. Confira:
```bash
curl -s http://localhost:8080/instance/connectionState/appfin -H "apikey: $EVO_KEY"   # state: "open"
```
Os dados da sessao ficam no volume `evolution_instances` e no banco `evolution`; nao precisa escanear de novo apos reiniciar.

## 6. Registrar o webhook na instancia

(O webhook global da Evolution fica DESLIGADO; o registro e por instancia.) O corpo e aninhado em `webhook`:

```bash
read -rs WHATSAPP_WEBHOOK_SECRET   # cola o segredo (fora do historico)
curl -s -X POST http://localhost:8080/webhook/set/appfin \
  -H "apikey: $EVO_KEY" -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "http://backend:3001/api/whatsapp/webhook",
      "byEvents": false,
      "base64": false,
      "headers": { "x-webhook-secret": "'"$WHATSAPP_WEBHOOK_SECRET"'" },
      "events": ["MESSAGES_UPSERT"]
    }
  }'
```
Confira com `curl -s http://localhost:8080/webhook/find/appfin -H "apikey: $EVO_KEY"` (rota `find` nao verificada na doc; se falhar, veja os logs).

## 7. Vincular um usuario

No app, logado, abra a pagina `/whatsapp`, informe o numero do WhatsApp pessoal, gere o codigo e envie-o ao numero do bot. O vinculo tem protecao anti forca bruta. Depois teste `saldo`.

## 8. Logs e diagnostico

```bash
docker logs --tail 100 finance_backend | grep -i whatsapp
docker logs --tail 100 finance_evolution
```
Os logs do backend nao incluem conteudo de mensagens.

## 9. Rollback

- Desligar so o modulo: mantenha `EVOLUTION_API_KEY` preenchida (forte) e ESVAZIE `WHATSAPP_WEBHOOK_SECRET` no `.env` (isso sozinho desativa o modulo, conforme `whatsappEnabled` em `env.ts`); rode `docker compose up -d backend`. NAO esvazie `EVOLUTION_API_KEY` enquanto a Evolution existir: ela e a `AUTHENTICATION_API_KEY` da Evolution.
- Remover a Evolution: `docker compose --profile whatsapp rm -sf evolution` (nao toca no Postgres) e remova `whatsapp` de `COMPOSE_PROFILES` no `.env`, para um proximo `up -d` nao recria-la.
- O backend nao depende da Evolution: se ela cair, o app segue funcionando.

## 10. Trocar o numero do bot

1. `curl -X DELETE http://localhost:8080/instance/logout/appfin -H "apikey: $EVO_KEY"` (pelo tunel).
2. Recrie/reconecte a instancia (passo 5) e escaneie o QR com o novo numero.
3. Atualize `WHATSAPP_BOT_NUMBER` no `.env` e rode `docker compose up -d backend`.
4. Reregistre o webhook (passo 6) se a instancia foi recriada. Os vinculos dos usuarios (numero pessoal) nao mudam.

## 11. Seguranca

- O webhook exige o header `x-webhook-secret` e rejeita requisicoes que passaram pelo proxy da Cloudflare (so a Evolution, na rede interna do Docker, deve chama-lo). `POST` ao dominio publico deve dar 404.
- A Evolution so escuta em `127.0.0.1:8080` e e acessada por tunel SSH. Nao exponha essa porta.
- `.env` nunca e commitado; segredos gerados com `openssl rand -hex 32`.

Chave de API vazia (verificado em `src/config/env.config.ts` da tag 2.3.7, https://raw.githubusercontent.com/EvolutionAPI/evolution-api/2.3.7/src/config/env.config.ts): `KEY: process.env.AUTHENTICATION_API_KEY || 'BQYHJGJHJ'`. Ou seja, variavel vazia ou ausente cai numa chave de exemplo hardcoded, e qualquer container da rede do compose (ou algo em 127.0.0.1) controlaria a sessao do WhatsApp. Por isso o servico fica atras do profile `whatsapp` e a chave deve ser sempre forte.

## 12. Verificacao ponta a ponta (com o numero real do bot)

- [ ] `docker ps`: 4 containers saudaveis e UM unico postgres; `GET /api/health` = 200.
- [ ] Vincular o usuario pela pagina `/whatsapp`.
- [ ] Enviar `saldo` (resposta sem IA).
- [ ] `gastei 47 no mercado` -> confirmacao -> `sim` -> transacao aparece no app.
- [ ] Mesmo pedido por audio.
- [ ] `quanto gastei com mercado esse mes?`.
- [ ] Mensagem de numero nao vinculado recebe a instrucao de vinculo.
- [ ] `curl -s -o /dev/null -w "%{http_code}\n" -X POST https://api-finance.walker.dev.br/api/whatsapp/webhook` -> 404.

## 13. O que foi / nao foi verificado na documentacao da Evolution

Verificado (codigo-fonte da tag 2.3.7 em github.com/EvolutionAPI/evolution-api, `.env.example`, `docker-compose.yaml`, Docker Hub `evoapicloud/evolution-api`):
- Imagem `evoapicloud/evolution-api`; ultima estavel v2.3.7 (2025-12-05); 2.4.0 so existe como rc; `latest` aponta para rc (por isso fixamos v2.3.7).
- Variaveis `DATABASE_*`, `CACHE_REDIS_ENABLED`/`CACHE_LOCAL_ENABLED`, `AUTHENTICATION_API_KEY`, `SERVER_URL`, `WEBHOOK_GLOBAL_*`; volume `/evolution/instances`.
- `POST /webhook/set/{instance}`: corpo aninhado em `webhook` com `enabled`, `url` (obrigatorios), `headers`, `byEvents`, `base64`, `events`.
- `sendText`: corpo `{ number, text }`. `getBase64FromMediaMessage`: corpo `{ message: { key: { id, remoteJid, fromMe } } }`, resposta contem `base64`, `mimetype`, `mediaType`, `fileName`.
- Antes de enviar o webhook, se `remoteJid` for `@lid` e existir `remoteJidAlt`, a Evolution troca um pelo outro.

NAO verificado (paginas doc.evolution-api.com retornaram 404 no momento da pesquisa; confirmar com mensagem real): formato exato de `instance/create`/QR, `webhook/find`, se `sendText.number` aceita JID completo (`...@s.whatsapp.net`; `@lid` nao verificado), a busca interna da mensagem em `getBase64FromMediaMessage` (so por `key.id`?), e a caixa do campo `event` no payload (o parser aceita `messages.upsert` e `MESSAGES_UPSERT`).
