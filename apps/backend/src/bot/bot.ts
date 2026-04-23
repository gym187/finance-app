import { Telegraf, Context, session } from 'telegraf';
import { Express } from 'express';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { transactionService } from '../services/transaction.service';
import { categoryService } from '../services/category.service';
import { dashboardService } from '../services/dashboard.service';
import { parseMessage, guessCategoryName } from './parser';
import { formatBRL, formatPercent, currentMonthName, progressBar } from './helpers';
import bcrypt from 'bcryptjs';

// ─── Session state ────────────────────────────────────────────────────────────
interface SessionData {
  userId?: number;
  pendingTransaction?: {
    type: 'INCOME' | 'EXPENSE';
    amount: number;
    description: string;
    categoryId: number;
    categoryName: string;
  };
  awaitingLoginEmail?: boolean;
  awaitingLoginPassword?: boolean;
  loginEmail?: string;
}

type BotContext = Context & { session: SessionData };

// ─── Helpers ─────────────────────────────────────────────────────────────────
async function autoRecover(ctx: BotContext): Promise<void> {
  if (ctx.session.userId) return;
  const telegramId = ctx.from?.id;
  if (!telegramId) return;
  try {
    const user = await prisma.user.findFirst({
      where: { telegramId: BigInt(telegramId) },
    });
    if (user) {
      ctx.session.userId = user.id;
    }
  } catch {
    // ignore – user just needs to /login
  }
}

async function requireAuth(ctx: BotContext): Promise<number | null> {
  await autoRecover(ctx);
  if (!ctx.session.userId) {
    await ctx.reply(
      '🔒 Você precisa fazer login primeiro.\nUse /login para vincular sua conta.'
    );
    return null;
  }
  return ctx.session.userId;
}

async function findOrCreateCategory(userId: number, hint: string): Promise<number> {
  const categoryName = guessCategoryName(hint);
  const categories = await categoryService.findAll(userId);

  // Try exact match first, then partial
  let cat = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
  if (!cat) {
    cat = categories.find((c) =>
      c.name.toLowerCase().includes(categoryName.toLowerCase().split(' ')[0])
    );
  }
  if (!cat) cat = categories.find((c) => c.name === 'Outros') ?? categories[0];
  if (!cat) {
    const newCat = await categoryService.create(userId, {
      name: categoryName,
      color: '#6b7280',
    });
    return newCat.id;
  }
  return cat.id;
}

// ─── Bot factory ──────────────────────────────────────────────────────────────
export function startBot(app: Express) {
  if (!env.TELEGRAM_BOT_TOKEN) return;

  const bot = new Telegraf<BotContext>(env.TELEGRAM_BOT_TOKEN);

  // Session middleware (in-memory; replace with redis for production)
  bot.use(session({ defaultSession: (): SessionData => ({}) }));

  // Global error handler — prevents unhandled errors from crashing the process
  bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}:`, err);
    ctx.reply('❌ Ocorreu um erro inesperado. Tente novamente.').catch(() => {});
  });

  // ─── /start ────────────────────────────────────────────────────────────────
  bot.start((ctx) =>
    ctx.reply(
      `👋 Olá! Sou seu assistente financeiro pessoal!\n\n` +
        `📋 *Comandos disponíveis:*\n` +
        `/login - Vincular sua conta\n` +
        `/logout - Desconectar\n` +
        `/saldo - Ver saldo atual\n` +
        `/entradas - Entradas do mês\n` +
        `/saidas - Saídas do mês\n` +
        `/relatorio - Relatório completo\n` +
        `/categorias - Listar categorias\n\n` +
        `💬 Ou simplesmente me diga o que fez:\n` +
        `_"paguei 120 de supermercado"_\n` +
        `_"recebi 2500 de salário"_`,
      { parse_mode: 'Markdown' }
    )
  );

  // ─── /help ─────────────────────────────────────────────────────────────────
  bot.help((ctx) =>
    ctx.reply(
      `🤖 *Como usar o bot:*\n\n` +
        `*Lançamentos em linguagem natural:*\n` +
        `• "paguei 50 de almoço"\n` +
        `• "gastei 200 no mercado"\n` +
        `• "recebi 3000 de salário"\n` +
        `• "comprei gasolina 150"\n\n` +
        `*Consultas:*\n` +
        `• "qual meu saldo?"\n` +
        `• "quanto gastei este mês?"\n` +
        `• "relatório do mês"\n` +
        `• "quais categorias mais gastei?"\n\n` +
        `*Comandos:*\n` +
        `/saldo /entradas /saidas /relatorio /categorias`,
      { parse_mode: 'Markdown' }
    )
  );

  // ─── /login ────────────────────────────────────────────────────────────────
  bot.command('login', (ctx) => {
    if (ctx.session.userId) {
      return ctx.reply('✅ Você já está conectado! Use /logout para sair.');
    }
    ctx.session.awaitingLoginEmail = true;
    ctx.session.awaitingLoginPassword = false;
    return ctx.reply('📧 Digite seu *email* cadastrado:', { parse_mode: 'Markdown' });
  });

  // ─── /logout ───────────────────────────────────────────────────────────────
  bot.command('logout', async (ctx) => {
    if (!ctx.session.userId) {
      return ctx.reply('Você não está conectado.');
    }
    // Unlink telegramId from user
    await prisma.user.update({
      where: { id: ctx.session.userId },
      data: { telegramId: null },
    });
    ctx.session.userId = undefined;
    ctx.session.awaitingLoginEmail = false;
    ctx.session.awaitingLoginPassword = false;
    return ctx.reply('👋 Logout realizado com sucesso!');
  });

  // ─── Shared handler functions ────────────────────────────────────────────
  async function handleSaldo(ctx: BotContext) {
    const userId = await requireAuth(ctx);
    if (!userId) return;

    try {
      const data = await dashboardService.getData(userId);
      await ctx.reply(
        `💰 *Saldo e Resumo - ${currentMonthName()}*\n\n` +
          `💵 Saldo total: *${formatBRL(data.balance)}*\n` +
          `📈 Entradas: *${formatBRL(data.totalIncome)}*\n` +
          `📉 Saídas: *${formatBRL(data.totalExpense)}*\n` +
          `💹 Resultado do mês: *${formatBRL(data.monthlyBalance)}*\n` +
          `🎯 Taxa de economia: *${formatPercent(data.savingsRate)}*`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Erro ao buscar saldo:', err);
      await ctx.reply('❌ Erro ao buscar saldo. Tente novamente.');
    }
  }

  async function handleRelatorio(ctx: BotContext) {
    const userId = await requireAuth(ctx);
    if (!userId) return;

    try {
      const data = await dashboardService.getData(userId);

      const budgetLines =
        data.budgetSummary.length > 0
          ? '\n\n📊 *Orçamentos:*\n' +
            data.budgetSummary
              .map(
                (b) =>
                  `• ${b.categoryName}: ${progressBar(b.percentage)} ${formatBRL(b.spent)}/${formatBRL(b.budgeted)}`
              )
              .join('\n')
          : '';

      const alertLines =
        data.alerts.length > 0
          ? '\n\n⚠️ *Alertas:*\n' + data.alerts.map((a) => `• ${a.message}`).join('\n')
          : '';

      await ctx.reply(
        `📋 *Relatório - ${currentMonthName()}*\n\n` +
          `💰 Saldo total: *${formatBRL(data.balance)}*\n` +
          `📈 Entradas: *${formatBRL(data.totalIncome)}*\n` +
          `📉 Saídas: *${formatBRL(data.totalExpense)}*\n` +
          `💹 Resultado: *${formatBRL(data.monthlyBalance)}*\n` +
          `🎯 Taxa de economia: *${formatPercent(data.savingsRate)}*` +
          budgetLines +
          alertLines,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Erro ao gerar relatório:', err);
      await ctx.reply('❌ Erro ao gerar relatório. Tente novamente.');
    }
  }

  // ─── /saldo ────────────────────────────────────────────────────────────────
  bot.command('saldo', (ctx) => handleSaldo(ctx));

  // ─── /entradas ─────────────────────────────────────────────────────────────
  bot.command('entradas', async (ctx) => {
    const userId = await requireAuth(ctx);
    if (!userId) return;

    try {
      const result = await transactionService.findAll(userId, {
        page: 1,
        limit: 10,
        type: 'INCOME',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      });

      if (result.data.length === 0) {
        return ctx.reply('📭 Nenhuma entrada registrada este mês.');
      }

      const total = result.data.reduce((s, t) => s + Number(t.amount), 0);
      const lines = result.data
        .slice(0, 10)
        .map(
          (t) =>
            `• ${new Date(t.date).toLocaleDateString('pt-BR')} - ${t.description}: *${formatBRL(Number(t.amount))}*`
        )
        .join('\n');

      await ctx.reply(
        `📈 *Entradas de ${currentMonthName()}*\n\n${lines}\n\n` +
          `*Total: ${formatBRL(total)}*` +
          (result.total > 10 ? `\n_... e mais ${result.total - 10} entradas_` : ''),
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Erro ao buscar entradas:', err);
      await ctx.reply('❌ Erro ao buscar entradas. Tente novamente.');
    }
  });

  // ─── /saidas ───────────────────────────────────────────────────────────────
  bot.command('saidas', async (ctx) => {
    const userId = await requireAuth(ctx);
    if (!userId) return;

    try {
      const result = await transactionService.findAll(userId, {
        page: 1,
        limit: 10,
        type: 'EXPENSE',
        startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      });

      if (result.data.length === 0) {
        return ctx.reply('📭 Nenhuma saída registrada este mês.');
      }

      const total = result.data.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      const lines = result.data
        .slice(0, 10)
        .map(
          (t) =>
            `• ${new Date(t.date).toLocaleDateString('pt-BR')} - ${t.description}: *${formatBRL(Math.abs(Number(t.amount)))}*`
        )
        .join('\n');

      await ctx.reply(
        `📉 *Saídas de ${currentMonthName()}*\n\n${lines}\n\n` +
          `*Total: ${formatBRL(total)}*` +
          (result.total > 10 ? `\n_... e mais ${result.total - 10} saídas_` : ''),
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Erro ao buscar saídas:', err);
      await ctx.reply('❌ Erro ao buscar saídas. Tente novamente.');
    }
  });

  // ─── /relatorio ────────────────────────────────────────────────────────────
  bot.command('relatorio', (ctx) => handleRelatorio(ctx));

  // ─── /categorias ───────────────────────────────────────────────────────────
  bot.command('categorias', async (ctx) => {
    const userId = await requireAuth(ctx);
    if (!userId) return;

    try {
      const categories = await categoryService.findAll(userId);
      const lines = categories.map((c) => `• ${c.name}`).join('\n');
      await ctx.reply(`🗂️ *Suas categorias:*\n\n${lines}`, { parse_mode: 'Markdown' });
    } catch (err) {
      console.error('Erro ao buscar categorias:', err);
      await ctx.reply('❌ Erro ao buscar categorias. Tente novamente.');
    }
  });

  // ─── Confirm transaction ───────────────────────────────────────────────────
  bot.action('confirm_tx', async (ctx) => {
    await ctx.answerCbQuery();
    const userId = ctx.session.userId;
    const pending = ctx.session.pendingTransaction;

    if (!userId || !pending) {
      return ctx.reply('❌ Sessão expirada. Tente novamente.');
    }

    try {
      await transactionService.create(userId, {
        description: pending.description,
        amount: pending.amount,
        type: pending.type,
        categoryId: pending.categoryId,
        date: new Date().toISOString().substring(0, 10),
      });

      ctx.session.pendingTransaction = undefined;
      const emoji = pending.type === 'INCOME' ? '📈' : '📉';
      await ctx.editMessageText(
        `✅ ${emoji} Transação registrada!\n` +
          `*${pending.description}* - ${formatBRL(pending.amount)}`,
        { parse_mode: 'Markdown' }
      );
    } catch (err) {
      console.error('Erro ao criar transação:', err);
      await ctx.reply('❌ Erro ao registrar transação. Tente novamente.');
    }
  });

  bot.action('cancel_tx', async (ctx) => {
    await ctx.answerCbQuery();
    ctx.session.pendingTransaction = undefined;
    await ctx.editMessageText('❌ Transação cancelada.');
  });

  // ─── Text message handler ──────────────────────────────────────────────────
  bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();

    // ── Login flow ────────────────────────────────────────────────────────────
    if (ctx.session.awaitingLoginEmail) {
      ctx.session.loginEmail = text;
      ctx.session.awaitingLoginEmail = false;
      ctx.session.awaitingLoginPassword = true;
      return ctx.reply('🔑 Agora digite sua *senha*:', { parse_mode: 'Markdown' });
    }

    if (ctx.session.awaitingLoginPassword && ctx.session.loginEmail) {
      const email = ctx.session.loginEmail;
      const password = text;
      ctx.session.awaitingLoginPassword = false;
      ctx.session.loginEmail = undefined;

      try {
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !(await bcrypt.compare(password, user.password))) {
          return ctx.reply('❌ Credenciais inválidas. Tente /login novamente.');
        }

        // Link Telegram account
        const telegramId = BigInt(ctx.from.id);
        await prisma.user.update({ where: { id: user.id }, data: { telegramId } });
        ctx.session.userId = user.id;

        return ctx.reply(
          `✅ Login realizado com sucesso!\nOlá, *${user.name ?? user.email}*! 🎉\n\nUse /help para ver os comandos disponíveis.`,
          { parse_mode: 'Markdown' }
        );
      } catch {
        return ctx.reply('❌ Erro ao fazer login. Tente novamente com /login.');
      }
    }

    // ── Require authentication for everything else ────────────────────────────
    const userId = await requireAuth(ctx);
    if (!userId) return;

    const lower = text.toLowerCase();

    // Natural language queries — call handlers directly instead of fabricating updates
    if (
      lower.includes('saldo') ||
      lower.includes('quanto tenho') ||
      lower.includes('meu saldo')
    ) {
      return handleSaldo(ctx);
    }

    if (lower.includes('relatório') || lower.includes('relatorio') || lower.includes('resumo')) {
      return handleRelatorio(ctx);
    }

    if (lower.includes('categoria') && (lower.includes('mais gastei') || lower.includes('gastos'))) {
      try {
        const data = await dashboardService.getData(userId);
        if (data.categoryData.length === 0) {
          return ctx.reply('📭 Nenhum gasto registrado este mês.');
        }
        const sorted = [...data.categoryData].sort((a, b) => b.value - a.value);
        const lines = sorted
          .slice(0, 5)
          .map((c, i) => `${i + 1}. ${c.name}: *${formatBRL(c.value)}*`)
          .join('\n');
        return ctx.reply(
          `🏆 *Top categorias (${currentMonthName()}):*\n\n${lines}`,
          { parse_mode: 'Markdown' }
        );
      } catch (err) {
        console.error('Erro ao buscar categorias:', err);
        return ctx.reply('❌ Erro ao buscar dados. Tente novamente.');
      }
    }

    // ── Natural language transaction ──────────────────────────────────────────
    const parsed = parseMessage(text);

    if (!parsed) {
      return ctx.reply(
        '🤔 Não entendi. Tente algo como:\n' +
          '"_paguei 50 de almoço_" ou "_recebi 2500 de salário_"\n\n' +
          'Use /help para mais exemplos.',
        { parse_mode: 'Markdown' }
      );
    }

    try {
      const categoryId = await findOrCreateCategory(userId, parsed.categoryHint);
      const categories = await categoryService.findAll(userId);
      const category = categories.find((c) => c.id === categoryId);
      const categoryName = category?.name ?? 'Outros';

      ctx.session.pendingTransaction = {
        type: parsed.type,
        amount: parsed.amount,
        description: parsed.description,
        categoryId,
        categoryName,
      };

      const emoji = parsed.type === 'INCOME' ? '📈' : '📉';
      const typeLabel = parsed.type === 'INCOME' ? 'Entrada' : 'Saída';

      await ctx.reply(
        `${emoji} *Confirmar lançamento?*\n\n` +
          `📝 Descrição: ${parsed.description}\n` +
          `💰 Valor: *${formatBRL(parsed.amount)}*\n` +
          `📌 Tipo: ${typeLabel}\n` +
          `🗂️ Categoria: ${categoryName}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ Confirmar', callback_data: 'confirm_tx' },
                { text: '❌ Cancelar', callback_data: 'cancel_tx' },
              ],
            ],
          },
        }
      );
    } catch (err) {
      console.error('Erro ao preparar transação:', err);
      await ctx.reply('❌ Erro ao processar lançamento. Tente novamente.');
    }
  });

  // ─── Launch ───────────────────────────────────────────────────────────────
  if (env.WEBHOOK_URL && env.NODE_ENV === 'production') {
    const webhookPath = '/bot/webhook';
    bot.telegram.setWebhook(`${env.WEBHOOK_URL}${webhookPath}`);
    app.use(bot.webhookCallback(webhookPath));
    console.log(`🤖 Bot em modo webhook: ${env.WEBHOOK_URL}${webhookPath}`);
  } else {
    // Long polling for development
    bot.launch({ dropPendingUpdates: true }).catch((err) => {
      console.error('❌ Falha ao iniciar bot Telegram:', err.message);
    });
    console.log('🤖 Bot em modo polling (desenvolvimento)');
  }

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}
