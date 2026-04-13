# AppFin — Controle Financeiro Pessoal

Aplicação completa de controle financeiro pessoal com interface web moderna e Telegram Bot conversacional integrado.

## Stack

| Camada | Tecnologia |
|--------|------------|
| Backend | Node.js 20 + Express 4 + TypeScript |
| Frontend | Next.js 15 App Router + Tailwind CSS + shadcn/ui |
| Banco de dados | PostgreSQL 16 + Prisma 5 |
| Autenticação | JWT (access 15 min) + Refresh Token (7 dias) |
| Telegram Bot | Telegraf.js v4 |
| Validação | Zod |
| Gráficos | Recharts |
| Estado servidor | TanStack Query v5 |

## Funcionalidades

- **Dashboard** — saldo, entradas/saídas, taxa de poupança, gráfico mensal (12 meses), gastos por categoria, progresso dos orçamentos e alertas
- **Transações** — CRUD completo, filtros por tipo/data/categoria, paginação, exportação CSV
- **Categorias** — CRUD com cor customizável e ícones
- **Orçamentos** — metas mensais por categoria ou total, alertas visuais (80 %/ 100 %)
- **Relatórios** — filtro por período, gráficos por categoria, exportação CSV e PDF
- **Telegram Bot** — consulta de saldo, lançamento de transações em linguagem natural (ex: *gastei 45 no mercado*)
- **Responsivo** — interface adaptada para desktop e mobile

---

## Deploy com Docker (recomendado)

### Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) v2+

### 1. Clone e configure

```bash
git clone <url> appfin && cd appfin

# Crie o arquivo de configuração
cp .env.example .env
```

### 2. Edite o `.env`

Abra o `.env` e altere **obrigatoriamente** os valores marcados:

```dotenv
# ─── Banco (os defaults já funcionam com o docker compose) ────────
POSTGRES_USER=finance
POSTGRES_PASSWORD=finance123        # ⚠️ troque em produção
POSTGRES_DB=financedb

# ─── JWT — gere strings aleatórias de 32+ chars ──────────────────
JWT_SECRET=TROQUE_AQUI_string_aleatoria_longa_min_32_chars
JWT_REFRESH_SECRET=TROQUE_AQUI_outra_string_aleatoria_diferente

# ─── Telegram Bot (opcional) ─────────────────────────────────────
# Crie um bot no @BotFather e cole o token aqui
TELEGRAM_BOT_TOKEN=
```

> **Dica:** gere segredos seguros com `openssl rand -base64 48`.

### 3. Suba tudo

```bash
docker compose up -d --build
```

Pronto! Acesse:

| Serviço | URL |
|---------|-----|
| Frontend | http://localhost:3002 |
| API Backend | http://localhost:3001 |
| Prisma Studio (dev) | `npm run db:studio` (fora do Docker) |

### Logs e diagnóstico

```bash
# Ver logs do backend (inclui bot)
docker compose logs -f backend

# Ver logs de todos os serviços
docker compose logs -f

# Status dos containers
docker compose ps
```

### Atualizar após mudanças no código

```bash
# Rebuild e reinicia (npm install fica cacheado — só recompila o código)
docker compose up -d --build
```

### Parar / remover

```bash
# Parar mantendo os dados
docker compose down

# Parar e apagar tudo (incluindo dados do banco!)
docker compose down -v
```

---

## Configuração manual (sem Docker)

### Pré-requisitos

- Node.js 20+
- npm 10+
- PostgreSQL 16

### Passos

```bash
# 1. Instale as dependências
npm install

# 2. Configure as variáveis de ambiente
cp .env.example .env
# Edite DATABASE_URL apontando para seu PostgreSQL

# 3. Execute as migrations
npm run db:migrate

# 4. Inicie em modo desenvolvimento
npm run dev
```

Backend: `http://localhost:3001` · Frontend: `http://localhost:3002`

---

## Scripts disponíveis (raiz do monorepo)

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Inicia backend + frontend em modo watch |
| `npm run build` | Compila backend + frontend |
| `npm run db:generate` | Gera o Prisma Client |
| `npm run db:migrate` | Executa migrations |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run lint` | Linting com ESLint |
| `npm run format` | Formatação com Prettier |

## Variáveis de ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `DATABASE_URL` | Connection string PostgreSQL | — |
| `POSTGRES_USER` | Usuário do PostgreSQL (Docker) | `finance` |
| `POSTGRES_PASSWORD` | Senha do PostgreSQL (Docker) | `finance123` |
| `POSTGRES_DB` | Nome do banco (Docker) | `financedb` |
| `JWT_SECRET` | Segredo do access token (min 32 chars) | — |
| `JWT_REFRESH_SECRET` | Segredo do refresh token | — |
| `JWT_EXPIRES_IN` | Expiração do access token | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Expiração do refresh token | `7d` |
| `TELEGRAM_BOT_TOKEN` | Token do BotFather | — |
| `WEBHOOK_URL` | URL HTTPS pública para webhook (produção) | — |
| `NEXT_PUBLIC_API_URL` | URL da API consumida pelo frontend | `http://localhost:3001` |
| `ALLOWED_ORIGINS` | Origens permitidas no CORS | `http://localhost:3002` |
| `PORT` | Porta do backend | `3001` |

## Telegram Bot

1. Crie um bot no [@BotFather](https://t.me/BotFather) e copie o token
2. Adicione `TELEGRAM_BOT_TOKEN=<token>` no `.env`
3. Reinicie: `docker compose up -d --build`
4. No Telegram, envie `/start` para o bot e depois `/login` com suas credenciais

### Comandos

| Comando | Descrição |
|---------|-----------|
| `/start` | Boas-vindas |
| `/help` | Lista de comandos |
| `/login` | Vincular conta |
| `/logout` | Encerrar sessão |
| `/saldo` | Resumo financeiro do mês |
| `/entradas` | Últimas receitas |
| `/saidas` | Últimas despesas |
| `/relatorio` | Relatório completo com orçamentos |
| `/categorias` | Lista de categorias |
| Texto livre | Registra transação (ex: *paguei 120 de luz*) |

> O bot reconhece sessões vinculadas automaticamente — mesmo que o container reinicie, não é necessário fazer `/login` novamente.

## Estrutura do projeto

```
appfin/
├── apps/
│   ├── backend/          # Express API + Telegram Bot
│   │   └── Dockerfile
│   └── frontend/         # Next.js 15 App
│       └── Dockerfile
├── packages/
│   └── shared/           # Tipos TypeScript compartilhados
├── prisma/
│   └── schema.prisma     # Schema do banco de dados
├── docker-compose.yml
├── .env.example
└── README.md
```

## Licença

MIT
