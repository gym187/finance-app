import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({
  txFindMany: vi.fn(),
}));
vi.mock('../../config/prisma', () => ({
  prisma: {
    $transaction: (ops: Promise<unknown>[]) => Promise.all(ops),
    transaction: { aggregate: async () => ({ _sum: { amount: 0 } }), findMany: m.txFindMany },
    budget: { findMany: async () => [] },
    recurringTransaction: { findMany: async () => [] },
    loan: { findMany: async () => [] },
    savingsGoal: { findMany: async () => [] },
  },
}));

import { dashboardService } from '../dashboard.service';

const tx = (date: string, type: 'INCOME' | 'EXPENSE', amount: number) => ({
  id: 1,
  userId: 1,
  date: new Date(`${date}T00:00:00Z`),
  type,
  amount: type === 'EXPENSE' ? -amount : amount,
  categoryId: 1,
  category: { id: 1, name: 'x', color: '#fff', icon: null },
});

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe('dashboardService.getData — dailyData', () => {
  it('30 dias, um ponto por dia do lançamento, dias vazios em zero', async () => {
    vi.setSystemTime(new Date('2026-11-23T15:00:00Z')); // 12:00 BR
    const txs = [
      tx('2026-11-18', 'EXPENSE', 69.55),
      tx('2026-11-19', 'EXPENSE', 69.77),
      tx('2026-11-22', 'EXPENSE', 93.23),
      tx('2026-11-22', 'INCOME', 10),
      tx('2026-10-20', 'EXPENSE', 999), // fora dos 30 dias (34 dias atrás)
    ];
    m.txFindMany.mockResolvedValue(txs);

    const { dailyData } = await dashboardService.getData(1);

    expect(dailyData).toHaveLength(30);
    expect(dailyData[0].date).toBe('2026-10-25');
    expect(dailyData[29].date).toBe('2026-11-23');
    const day = (d: string) => dailyData.find((x) => x.date === d)!;
    expect(day('2026-11-18')).toEqual({ date: '2026-11-18', income: 0, expense: 69.55 });
    expect(day('2026-11-19').expense).toBe(69.77);
    expect(day('2026-11-22')).toMatchObject({ income: 10, expense: 93.23 });
    expect(day('2026-11-20')).toEqual({ date: '2026-11-20', income: 0, expense: 0 });
    expect(dailyData.reduce((s, d) => s + d.expense, 0)).toBeCloseTo(232.55, 2);
  });

  it('às 22:30 de Brasília ainda é o dia local (não vira o dia UTC)', async () => {
    vi.setSystemTime(new Date('2026-11-24T01:30:00Z')); // 22:30 BR de 23/11
    m.txFindMany.mockResolvedValue([tx('2026-11-23', 'EXPENSE', 5)]);
    const { dailyData } = await dashboardService.getData(1);
    expect(dailyData[29].date).toBe('2026-11-23');
    expect(dailyData[29].expense).toBe(5);
  });
});
