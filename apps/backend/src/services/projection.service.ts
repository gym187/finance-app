import { format, startOfMonth, subMonths, addMonths } from 'date-fns';
import { prisma } from '../config/prisma';
import { nowBR } from '../config/date';

// Monthly multiplier for each recurrency frequency
const MONTHLY_FACTOR: Record<string, number> = {
  MONTHLY: 1,
  BIWEEKLY: 2.17,
  WEEKLY: 4.33,
  DAILY: 30,
};

export const projectionService = {
  async getProjection(userId: number) {
    const now = nowBR();
    const sixMonthsAgo = startOfMonth(subMonths(now, 6));

    const [allTime, last6Months, activeRecurring] = await Promise.all([
      prisma.transaction.aggregate({ where: { userId }, _sum: { amount: true } }),
      prisma.transaction.findMany({
        where: { userId, date: { gte: sixMonthsAgo } },
        orderBy: { date: 'asc' },
      }),
      prisma.recurringTransaction.findMany({
        where: { userId, isActive: true },
      }),
    ]);

    // ─── Current balance ────────────────────────────────────────────────────
    const currentBalance = Number(allTime._sum.amount ?? 0);

    // ─── Monthly recurring net (conservative projection base) ───────────────
    let recurringMonthlyNet = 0;
    for (const r of activeRecurring) {
      const factor = MONTHLY_FACTOR[r.frequency] ?? 1;
      const amount = Number(r.amount); // positive = income, negative = expense
      recurringMonthlyNet += amount * factor;
    }

    // ─── Historical average monthly net (last 6 complete months) ────────────
    // Build a map of month -> net for the last 6 months
    const monthlyMap = new Map<string, number>();
    for (let i = 1; i <= 6; i++) {
      monthlyMap.set(format(subMonths(now, i), 'yyyy-MM'), 0);
    }
    for (const t of last6Months) {
      const month = format(t.date, 'yyyy-MM');
      if (monthlyMap.has(month)) {
        monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + Number(t.amount));
      }
    }

    const monthlyNets = Array.from(monthlyMap.values());
    const historicalAvgMonthly =
      monthlyNets.length > 0
        ? monthlyNets.reduce((s, v) => s + v, 0) / monthlyNets.length
        : 0;

    // ─── Build 12-month forward projection ─────────────────────────────────
    const projection: {
      month: string;
      label: string;
      optimistic: number;
      conservative: number;
    }[] = [];

    // Month 0 = current state (anchor point for the chart)
    projection.push({
      month: format(now, 'yyyy-MM'),
      label: formatMonthShort(now),
      optimistic: currentBalance,
      conservative: currentBalance,
    });

    let optBalance = currentBalance;
    let conBalance = currentBalance;

    for (let i = 1; i <= 12; i++) {
      const futureDate = addMonths(now, i);
      // Conservative: only recurring net (fixed commitments, no extra savings)
      conBalance += recurringMonthlyNet;
      // Optimistic: historical average monthly net (maintains current saving behavior)
      optBalance += historicalAvgMonthly;

      projection.push({
        month: format(futureDate, 'yyyy-MM'),
        label: formatMonthShort(futureDate),
        optimistic: Math.round(optBalance * 100) / 100,
        conservative: Math.round(conBalance * 100) / 100,
      });
    }

    return {
      currentBalance,
      recurringMonthlyNet: Math.round(recurringMonthlyNet * 100) / 100,
      historicalAvgMonthly: Math.round(historicalAvgMonthly * 100) / 100,
      projection,
    };
  },
};

function formatMonthShort(date: Date): string {
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
}
