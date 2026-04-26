import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { prisma } from '../config/prisma';

export const dashboardService = {
  async getData(userId: number) {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));
    const twelveMonthsAgo = startOfMonth(subMonths(now, 11));
    const currentMonthStr = format(now, 'yyyy-MM');

    const [allTime, currentMonthTxs, prevMonthAgg, last12MonthsTxs, budgets] =
      await prisma.$transaction([
        prisma.transaction.aggregate({ where: { userId }, _sum: { amount: true } }),
        prisma.transaction.findMany({
          where: { userId, date: { gte: currentMonthStart, lte: currentMonthEnd } },
          include: { category: true },
        }),
        prisma.transaction.aggregate({
          where: { userId, date: { gte: prevMonthStart, lte: prevMonthEnd } },
          _sum: { amount: true },
        }),
        prisma.transaction.findMany({
          where: { userId, date: { gte: twelveMonthsAgo } },
          orderBy: { date: 'asc' },
        }),
        prisma.budget.findMany({
          where: { userId },
          include: { category: true },
        }),
      ]);

    // ─── Summary ─────────────────────────────────────────────────────────────
    const balance = Number(allTime._sum.amount ?? 0);

    const totalIncome = currentMonthTxs
      .filter((t) => t.type === 'INCOME')
      .reduce((s, t) => s + Number(t.amount), 0);

    const totalExpense = Math.abs(
      currentMonthTxs
        .filter((t) => t.type === 'EXPENSE')
        .reduce((s, t) => s + Number(t.amount), 0)
    );

    const monthlyBalance = totalIncome - totalExpense;
    const previousMonthBalance = Number(prevMonthAgg._sum.amount ?? 0);
    const balanceVariation =
      previousMonthBalance !== 0
        ? ((monthlyBalance - previousMonthBalance) / Math.abs(previousMonthBalance)) * 100
        : 0;
    const savingsRate = totalIncome > 0 ? (monthlyBalance / totalIncome) * 100 : 0;

    // ─── Monthly chart (last 12 months) ──────────────────────────────────────
    const monthlyMap = new Map<string, { income: number; expense: number }>();
    for (let i = 11; i >= 0; i--) {
      monthlyMap.set(format(subMonths(now, i), 'yyyy-MM'), { income: 0, expense: 0 });
    }
    for (const t of last12MonthsTxs) {
      const month = format(t.date, 'yyyy-MM');
      const entry = monthlyMap.get(month);
      if (entry) {
        if (t.type === 'INCOME') entry.income += Number(t.amount);
        else entry.expense += Math.abs(Number(t.amount));
      }
    }
    const monthlyData = Array.from(monthlyMap.entries()).map(([month, d]) => ({
      month,
      income: d.income,
      expense: d.expense,
      balance: d.income - d.expense,
    }));

    // ─── Category pie (current month expenses) ────────────────────────────────
    const catMap = new Map<number, { name: string; value: number; color: string; icon?: string }>();
    for (const t of currentMonthTxs.filter((t) => t.type === 'EXPENSE')) {
      const cid = t.categoryId;
      if (!catMap.has(cid)) {
        catMap.set(cid, {
          name: t.category.name,
          value: 0,
          color: t.category.color ?? '#6b7280',
          icon: t.category.icon ?? undefined,
        });
      }
      catMap.get(cid)!.value += Math.abs(Number(t.amount));
    }
    const categoryData = Array.from(catMap.values()).filter((c) => c.value > 0);

    // ─── Budget summary ───────────────────────────────────────────────────────
    const budgetSummary = budgets.map((b) => {
      let spent = 0;
      if (b.categoryId !== null) {
        const txs = currentMonthTxs.filter((t) => t.categoryId === b.categoryId);
        spent = txs.reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
      } else {
        if (b.type === 'INCOME') spent = totalIncome;
        else if (b.type === 'EXPENSE') spent = totalExpense;
        else spent = totalExpense; // TOTAL
      }

      const budgeted = Number(b.amount);
      const percentage = budgeted > 0 ? (spent / budgeted) * 100 : 0;

      return {
        id: b.id,
        categoryId: b.categoryId,
        categoryName: b.category?.name ?? 'Orçamento Total',
        budgeted,
        spent,
        percentage,
        type: b.type,
      };
    });

    // ─── Alerts ───────────────────────────────────────────────────────────────
    const alerts: { type: 'warning' | 'danger'; message: string; categoryId?: number }[] = [];
    for (const s of budgetSummary) {
      if (s.percentage >= 100) {
        alerts.push({
          type: 'danger',
          message: `Orçamento "${s.categoryName}" ultrapassado (${s.percentage.toFixed(0)}%)`,
          categoryId: s.categoryId ?? undefined,
        });
      } else if (s.percentage >= 80) {
        alerts.push({
          type: 'warning',
          message: `Orçamento "${s.categoryName}" em ${s.percentage.toFixed(0)}% do limite`,
          categoryId: s.categoryId ?? undefined,
        });
      }
    }

    // ─── Recurring summary for current month ────────────────────────────────
    const activeRecurring = await prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
      include: { category: true },
    });

    const recurringIncome = activeRecurring
      .filter((r) => r.type === 'INCOME')
      .reduce((s, r) => s + Math.abs(Number(r.amount)), 0);

    const recurringExpense = activeRecurring
      .filter((r) => r.type === 'EXPENSE')
      .reduce((s, r) => s + Math.abs(Number(r.amount)), 0);

    const recurringItems = activeRecurring.map((r) => ({
      id: r.id,
      description: r.description,
      amount: Math.abs(Number(r.amount)),
      type: r.type,
      frequency: r.frequency,
      nextDueDate: r.nextDueDate.toISOString(),
      categoryName: r.category.name,
      categoryColor: r.category.color ?? '#6b7280',
    }));

    // ─── Loans summary ───────────────────────────────────────────────────────
    const activeLoans = await prisma.loan.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
      take: 3,
    });

    const loansWidget = activeLoans.map((l) => {
      const balance = Number(l.currentBalance);
      const rate = Number(l.interestRate) / 100;
      const interest = balance * rate;
      const installment = l.installmentAmount ? Number(l.installmentAmount) : balance + interest;

      // next due date
      const nowD = new Date();
      let due = new Date(nowD.getFullYear(), nowD.getMonth(), l.dueDayOfMonth);
      if (due <= nowD) due = new Date(nowD.getFullYear(), nowD.getMonth() + 1, l.dueDayOfMonth);

      return {
        id: l.id,
        name: l.name,
        currentBalance: balance,
        installmentAmount: installment,
        nextDueDate: due.toISOString(),
      };
    });

    const totalDebt = activeLoans.reduce((s, l) => s + Number(l.currentBalance), 0);

    // ─── Savings goals summary ────────────────────────────────────────────────
    const savingsGoals = await prisma.savingsGoal.findMany({
      where: { userId, isCompleted: false },
      orderBy: { deadline: 'asc' },
      take: 3,
    });

    const goalsWidget = savingsGoals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: Number(g.targetAmount),
      currentAmount: Number(g.currentAmount),
      deadline: g.deadline?.toISOString() ?? null,
      color: g.color ?? '#3b82f6',
      icon: g.icon ?? null,
      percent: Number(g.targetAmount) > 0
        ? Math.min(100, (Number(g.currentAmount) / Number(g.targetAmount)) * 100)
        : 0,
    }));

    return {
      balance,
      totalIncome,
      totalExpense,
      savingsRate,
      monthlyBalance,
      previousMonthBalance,
      balanceVariation,
      monthlyData,
      categoryData,
      budgetSummary,
      alerts,
      recurringIncome,
      recurringExpense,
      recurringItems,
      goalsWidget,
      loansWidget,
      totalDebt,
    };
  },
};
