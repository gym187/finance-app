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

---

## Deploy em Proxmox / VPS

Guia para deploy em uma VM Proxmox (Debian/Ubuntu) ou qualquer VPS Linux.

### Requisitos da VM/VPS

- Debian 12 / Ubuntu 22.04+ (ou derivado)
- 1 vCPU + 1 GB RAM (mínimo) — recomendado 2 vCPU + 2 GB
- 10 GB de disco livre
- Porta 80/443 liberada no firewall

### 1. Instale Docker e Docker Compose

```bash
# Atualize o sistema
sudo apt update && sudo apt upgrade -y

# Instale dependências
sudo apt install -y ca-certificates curl gnupg

# Adicione a chave GPG do Docker
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Adicione o repositório (Ubuntu — para Debian troque "ubuntu" por "debian")
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Instale Docker
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Permita seu usuário usar docker sem sudo
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Clone o projeto e configure

```bash
git clone <url> /opt/appfin && cd /opt/appfin
cp .env.example .env
```

Edite o `.env` com valores de produção:

```dotenv
# ─── Banco ────────────────────────────────────────────────────────
POSTGRES_USER=finance
POSTGRES_PASSWORD=UMA_SENHA_FORTE_AQUI        # ⚠️ obrigatório trocar
POSTGRES_DB=financedb

# ─── JWT ──────────────────────────────────────────────────────────
JWT_SECRET=<gere com: openssl rand -base64 48>
JWT_REFRESH_SECRET=<gere com: openssl rand -base64 48>

# ─── URLs (ajuste para seu domínio ou IP) ─────────────────────────
NEXT_PUBLIC_API_URL=https://seu-dominio.com
ALLOWED_ORIGINS=https://seu-dominio.com

# ─── Telegram Bot (opcional) ──────────────────────────────────────
TELEGRAM_BOT_TOKEN=
WEBHOOK_URL=https://seu-dominio.com
```

> **Importante:** `NEXT_PUBLIC_API_URL` é compilado no build do frontend. Se mudar, faça rebuild: `docker compose up -d --build frontend`.

### 3. Suba a aplicação

```bash
docker compose up -d --build
```

Verifique se tudo está rodando:

```bash
docker compose ps
docker compose logs -f
```

### 4. Configure reverse proxy com Traefik + HTTPS

Traefik roda como container Docker e obtém certificados SSL automaticamente via Let's Encrypt.

Crie o arquivo `docker-compose.traefik.yml` na raiz do projeto:

```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: traefik
    restart: unless-stopped
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--entrypoints.web.http.redirections.entrypoint.to=websecure"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge=true"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
      - "--certificatesresolvers.letsencrypt.acme.email=seu-email@exemplo.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_certs:/letsencrypt

volumes:
  traefik_certs:
```

Adicione labels aos serviços no `docker-compose.yml`:

```yaml
  backend:
    # ... configurações existentes ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.backend.rule=Host(`seu-dominio.com`) && PathPrefix(`/api`, `/bot`)"
      - "traefik.http.routers.backend.entrypoints=websecure"
      - "traefik.http.routers.backend.tls.certresolver=letsencrypt"
      - "traefik.http.services.backend.loadbalancer.server.port=3001"

  frontend:
    # ... configurações existentes ...
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.frontend.rule=Host(`seu-dominio.com`)"
      - "traefik.http.routers.frontend.entrypoints=websecure"
      - "traefik.http.routers.frontend.tls.certresolver=letsencrypt"
      - "traefik.http.services.frontend.loadbalancer.server.port=3000"
      - "traefik.http.routers.frontend.priority=1"
```

> **Nota:** o router do backend tem prioridade maior automaticamente por ter `PathPrefix`, então as rotas `/api` e `/bot` vão para o backend e todo o resto vai para o frontend.

Suba tudo junto:

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

Em produção, remova os `ports` expostos do backend e frontend no `docker-compose.yml` (Traefik se comunica pela rede interna do Docker):

```yaml
  backend:
    # remova ou comente:
    # ports:
    #   - "3001:3001"

  frontend:
    # remova ou comente:
    # ports:
    #   - "3002:3000"
```

Após configurar, atualize o `.env`:

```dotenv
NEXT_PUBLIC_API_URL=https://seu-dominio.com
ALLOWED_ORIGINS=https://seu-dominio.com
WEBHOOK_URL=https://seu-dominio.com
```

Rebuild (necessário porque `NEXT_PUBLIC_API_URL` é compilado no build):

```bash
docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
```

### 5. Atualizações

```bash
cd /opt/appfin
git pull
docker compose up -d --build
```

### 6. Backup do banco de dados

```bash
# Backup manual
docker exec finance_postgres pg_dump -U finance financedb > backup_$(date +%F).sql

# Restaurar
cat backup_2026-04-13.sql | docker exec -i finance_postgres psql -U finance financedb
```

Para backups automáticos, adicione ao crontab:

```bash
crontab -e
# Adicione (backup diário às 3h):
0 3 * * * docker exec finance_postgres pg_dump -U finance financedb | gzip > /opt/backups/appfin_$(date +\%F).sql.gz
```

### Dicas para Proxmox

- **Firewall:** libere as portas 80 e 443 na aba Firewall da VM (ou do datacenter)
- **Recursos:** comece com 2 vCPU / 2 GB RAM; ajuste conforme uso
- **Snapshots:** tire um snapshot da VM antes de atualizações grandes
- **IP fixo:** configure IP estático na VM em `/etc/network/interfaces` ou via Cloud-Init

---

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
