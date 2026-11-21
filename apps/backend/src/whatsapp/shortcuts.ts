import { dashboardService } from '../services/dashboard.service';
import { transactionService } from '../services/transaction.service';
import { budgetService } from '../services/budget.service';
import { loanService } from '../services/loan.service';
import { formatBRL, normalizeText } from './format';

export type Shortcut =
  | 'saldo'
  | 'resumo'
  | 'ultimas'
  | 'orcamentos'
  | 'dividas'
  | 'ajuda'
  | 'sair'
  | 'sim'
  | 'nao';

const ALIASES: Record<string, Shortcut> = {
  saldo: 'saldo',
  resumo: 'resumo',
  ultimas: 'ultimas',
  extrato: 'ultimas',
  orcamentos: 'orcamentos',
  dividas: 'dividas',
  ajuda: 'ajuda',
  sair: 'sair',
  sim: 'sim',
  nao: 'nao',
};

export function matchShortcut(text: string, hasPending: boolean): Shortcut | null {
  const s = ALIASES[normalizeText(text)];
  if (!s) return null;
  if ((s === 'sim' || s === 'nao') && !hasPending) return null;
  return s;
}

function ddmm(d: Date | string): string {
  const dt = new Date(d);
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(dt);
}

const HELP = [
  '*Posso ajudar com:*',
  '• saldo',
  '• resumo',
  '• últimas',
  '• orçamentos',
  '• dívidas',
  '• gastei 47 no mercado',
  '• quanto gastei com comida esse mês?',
  '• sair',
].join('\n');

export async function runShortcut(
  userId: number,
  s: Exclude<Shortcut, 'sim' | 'nao' | 'sair'>
): Promise<string> {
  switch (s) {
    case 'ajuda':
      return HELP;

    case 'saldo': {
      const d = await dashboardService.getData(userId);
      return `💰 Saldo do mês: *${formatBRL(Number(d.balance))}*`;
    }

    case 'resumo': {
      const d = await dashboardService.getData(userId);
      return [
        '*Resumo do mês*',
        `🟢 Receitas: ${formatBRL(Number(d.totalIncome))}`,
        `🔴 Despesas: ${formatBRL(Math.abs(Number(d.totalExpense)))}`,
        `💰 Saldo: ${formatBRL(Number(d.balance))}`,
      ].join('\n');
    }

    case 'ultimas': {
      const r = await transactionService.findAll(userId, { page: 1, limit: 5 });
      if (r.data.length === 0) return 'Você ainda não tem lançamentos.';
      const lines = r.data.map((t) => {
        const amount = formatBRL(Math.abs(Number(t.amount)));
        const mark = t.type === 'INCOME' ? '🟢' : '🔴';
        const cat = t.category?.name ? ` (${t.category.name})` : '';
        return `${mark} ${ddmm(t.date)} ${t.description} — ${amount}${cat}`;
      });
      return ['*Últimos lançamentos*', ...lines].join('\n');
    }

    case 'orcamentos': {
      const budgets = await budgetService.findAll(userId);
      if (budgets.length === 0) return 'Você ainda não tem orçamentos.';
      const d = await dashboardService.getData(userId);
      if (d.budgetSummary.length === 0) return 'Você ainda não tem orçamentos.';
      const lines = d.budgetSummary.map(
        (b) =>
          `• ${b.categoryName}: ${formatBRL(b.spent)} / ${formatBRL(b.budgeted)} (${Math.round(b.percentage)}%)`
      );
      return ['*Orçamentos do mês*', ...lines].join('\n');
    }

    case 'dividas': {
      const l = await loanService.summary(userId);
      if (l.activeCount === 0) return 'Você não tem dívidas ativas. 🎉';
      const lines = l.nextDue.slice(0, 3).map((n) => {
        const inst = n.installmentAmount != null ? ` — ${formatBRL(n.installmentAmount)}` : '';
        return `• ${n.name}: vence ${ddmm(n.dueDate)}${inst}`;
      });
      return [
        `*Dívidas ativas:* ${l.activeCount}`,
        `Total devido: ${formatBRL(l.totalDebt)}`,
        '',
        '*Próximos vencimentos*',
        ...lines,
      ].join('\n');
    }
  }
}
