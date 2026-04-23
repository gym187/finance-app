# Finance App — Roadmap de Melhorias

> Arquivo de controle de evolução do projeto. Use-o como referência antes de qualquer implementação.

---

## ✅ Concluído

### v1.0 — Base da Aplicação
- Autenticação JWT (access + refresh tokens)
- CRUD de Transações com filtros, paginação e busca
- CRUD de Categorias com cor e ícone
- Orçamentos mensais por categoria com alertas (80% / 100%)
- Dashboard com cards de resumo, gráfico mensal e pizza de categorias
- Relatórios com export CSV e PDF
- Bot Telegram com linguagem natural
- Dark mode
- Layout responsivo (desktop + mobile sidebar)
- Docker Compose com PostgreSQL

---

## ✅ Concluído — v1.1 (2026-04-21)

### Dashboard Principal — Redesign
- [x] Substituir gráfico de linha por AreaChart com gradiente (mais moderno)
- [x] Novo componente `QuickStats` — cards com ícones e link direto para transações
- [x] Widget `RecentTransactions` — últimas 6 transações com ícone por tipo
- [x] `FinancialHealthBar` — score 0-100 com indicadores de saúde financeira
- [x] `CategoryPieChart` redesenhado como Donut com lista de categorias abaixo
- [x] `BudgetProgress` melhorado com valor restante e badges de alerta
- [x] Layout do dashboard reorganizado em seções lógicas

### Dashboard de Investimentos — Novo
- [x] Modelo `Investment` no banco (Prisma schema + migration `add_investments`)
- [x] API REST: GET/POST/PATCH/DELETE `/api/investments`
- [x] Endpoint de resumo `/api/investments/summary` (P&L, alocação, holdings) 
- [x] Página `/investments` com:
  - Cards: Total Investido, Valor Atual, Rendimento (R$ + %), Diversificação
  - Gráfico Donut de alocação por classe de ativo
  - Painel de performance por classe
  - Tabela completa de ativos com P&L por ativo
  - Modal de CRUD (Adicionar/Editar/Excluir)
- [x] Item "Investimentos" na Sidebar com ícone `LineChart`
- [x] `useInvestments` e `useInvestmentSummary` hooks
- [x] Build frontend (Next.js) e backend (tsc) sem erros

## ✅ Concluído — v1.2 (2026-04-21)

### Transações Recorrentes
- [x] Modelo `RecurringTransaction` no banco (DAILY, WEEKLY, BIWEEKLY, MONTHLY)
- [x] API REST: GET/POST/PATCH/DELETE `/api/recurring`
- [x] Processamento automático no startup + a cada hora (gera transações vencidas com catch-up)
- [x] Página `/recurring` com cards de resumo mensal, lista ativa/pausada e CRUD
- [x] Toggle pausar/reativar por item
- [x] Item "Recorrentes" na Sidebar com ícone `Repeat2`

---

## ✅ Concluído — v1.3 (2026-04-21)

### Índices no banco de dados
- [x] `Transaction(userId, date)` — consultas do dashboard
- [x] `Transaction(userId, categoryId)` — relatórios por categoria
- [x] `Budget(userId, month)` — carregamento de orçamentos
- [x] `RecurringTransaction(userId, isActive, nextDueDate)` — processDue()
- [x] `Investment(userId)` — listagem de carteira

### Metas de Poupança
- [x] Modelo `SavingsGoal`: name, targetAmount, currentAmount, deadline, color, icon
- [x] API REST: GET/POST/PATCH/DELETE `/api/goals`
- [x] Endpoint de contribuição: `POST /api/goals/:id/contribute`
- [x] Página `/goals` com cards de progresso visual, prazo e valor por mês necessário
- [x] Widget "Metas" no dashboard (top 3 metas ativas)
- [x] Item "Metas" na Sidebar com ícone `Target`

---

## ✅ Concluído — v1.6 (2026-04-22)

### PWA (Progressive Web App)
- [x] `manifest.ts` — nome, ícones, atalhos, standalone display
- [x] `public/sw.js` — cache-first estático, network-first navegação, fallback offline
- [x] `app/offline/page.tsx` — página de fallback offline
- [x] `PWAProvider` — registra SW, solicita permissão de notificação, assina push
- [x] `InstallBanner` — banner de instalação no mobile com dismiss persistente

### Web Push Notifications
- [x] Modelos `PushSubscription` e `AppNotification` no banco
- [x] API: `GET /api/push/vapid-key`, `POST /api/push/subscribe`, `POST /api/push/unsubscribe`
- [x] API: `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`, `DELETE /api/notifications/:id`
- [x] SW handler para eventos push e notificationclick
- [x] Push disparado em: alertas de orçamento (80%/100%), meta atingida, empréstimo vencendo
- [x] Polling de vencimento de empréstimos no startup + a cada hora

### Centro de Notificações (in-app)
- [x] Componente `NotificationCenter` no Header com badge de não lidas
- [x] Lista com ícone por tipo, tempo relativo, marcar como lida, excluir
- [x] `useNotifications` hook com refresh a cada 30s
- [x] Notificações criadas automaticamente em: alertas de orçamento, meta atingida, empréstimo vencendo

### Deploy Production
- [x] `apps/backend/Dockerfile` — multi-stage build (builder + runner Alpine)
- [x] `apps/frontend/Dockerfile` — Next.js standalone output
- [x] `docker-compose.prod.yml` — stack completa com PostgreSQL, backend, frontend
- [x] `.env.example` — documentação de todas variáveis incluindo VAPID
- [x] `.github/workflows/ci.yml` — typecheck + build backend + build frontend + docker build

---

## 📋 Próximas Implementações (priorizadas por impacto)

#### Projeção de Patrimônio ✅ (2026-04-21)
- [x] Endpoint `GET /api/dashboard/projection`
- [x] Projeção baseada em: saldo atual + recorrentes ativos + tendência histórica (6 meses)
- [x] Linha "otimista" (média histórica/mês) e "conservadora" (apenas recorrências fixas)
- [x] Gráfico AreaChart com gradiente na página de Relatórios
- [x] Cards com valor projetado em 12 meses e variação esperada
- [x] Explicação inline das premissas de cada linha

#### Fix — Tooltips de Gráficos no Dark Mode ✅ (2026-04-22)
- [x] `TOOLTIP_STYLE` centralizado em `lib/chartUtils.ts` usando `--popover`/`--popover-foreground` do shadcn
- [x] Aplicado em: MonthlyChart, CategoryPieChart, AllocationChart, WealthProjection, Relatórios (BarChart + PieChart)

#### Módulo de Empréstimos ✅ (2026-04-22)
- [x] Modelos `Loan` e `LoanPayment` no banco + migration `add_loans`
- [x] API REST completa: GET/POST/PATCH/DELETE `/api/loans`
- [x] `POST /api/loans/:id/pay` — pagamento FULL ou INTEREST_ONLY com cálculo Price
- [x] `GET /api/loans/:id/payments` — histórico de pagamentos
- [x] `GET /api/loans/:id/schedule` — tabela Price futura (parcelas restantes)
- [x] `GET /api/loans/summary` — total em dívida, total pago, próximos vencimentos
- [x] Página `/loans` com cards de resumo, lista de ativos com barra de progresso, modais de CRUD e pagamento, drawer de histórico + tabela Price
- [x] Widget de empréstimos no dashboard (saldo devedor total + alerta de vencimento próximo)
- [x] Item "Empréstimos" na Sidebar com ícone `CreditCard`

#### Import de Extrato CSV ✅ (2026-04-22)
- [x] Endpoints `POST /api/import/parse` (multipart) e `POST /api/import/confirm`
- [x] Parser flexível: detecta separador (`,` ou `;`), colunas por nome e posição
- [x] Suporte a datas dd/mm/aaaa, dd-mm-aaaa, aaaa-mm-dd e valores BR/US
- [x] Tipo inferido por coluna explícita ou pelo sinal do valor
- [x] Auto-categorização por palavras-chave (compara nome da categoria com descrição)
- [x] Detecção de duplicatas (mesma data + valor + descrição)
- [x] Modal em 3 etapas: upload (drag & drop) → preview/ajuste → confirmação
- [x] Preview editável: toggle tipo (Entrada/Saída), seletor de categoria, checkbox de pular linha
- [x] Botão "Importar CSV" na página de Transações

### v1.4 — Qualidade & Segurança ✅ (2026-04-22, parcial)
- [x] Redefinição de senha por email (Resend + fallback console em dev)
- [x] Verificação de email no cadastro (token de 24h, reenvio disponível)
- [x] Rate limiting global (300 req/15min geral, 20 auth, 5 reset de senha)
- [x] Logging estruturado com Pino (HTTP requests + app logs com redact de senha)
- [x] Migrar JWT de localStorage para httpOnly cookies + CSRF token (double-submit cookie)

### v1.5 — Avançado (parcial — 2026-04-22)
- [x] Notificações de alerta de orçamento por email (80% e 100%, uma vez por mês por orçamento)
- [x] Tags nas transações (CRUD, seletor no form, badges na tabela, filtro por tag, export CSV)
- [ ] Multi-conta bancária (corrente, poupança, carteira digital)
- [x] Multi-moeda (USD, EUR, GBP, BTC) — cotação em tempo real via Frankfurter + CoinGecko, cache 1h, conversão automática para BRL
- [ ] Sessões do bot Telegram em Redis

---

## Tipos de Investimento Suportados (v1.1)

| Tipo | Label |
|---|---|
| `STOCK` | Ações |
| `FII` | Fundos Imobiliários |
| `ETF` | ETFs |
| `CRYPTO` | Criptomoedas |
| `FIXED_INCOME` | Renda Fixa |
| `OTHER` | Outros |

---

## Estrutura de Arquivos Relevantes

```
apps/
  backend/src/
    services/investment.service.ts       ← lógica de negócio
    controllers/investment.controller.ts ← req/res handlers
    routes/investment.routes.ts          ← Express router
    validators/investment.validator.ts   ← Zod schemas
  frontend/src/
    app/(dashboard)/investments/page.tsx ← página principal
    components/investments/
      InvestmentSummaryCards.tsx
      AllocationChart.tsx
      HoldingsTable.tsx
      InvestmentModal.tsx
    hooks/useInvestments.ts
    lib/api.ts                           ← adicionar investments.*
prisma/schema.prisma                     ← modelo Investment
```
