import { prisma } from '../config/prisma';

const TYPE_LABELS: Record<string, string> = {
  STOCK: 'Ações',
  FII: 'Fundos Imobiliários',
  ETF: 'ETFs',
  CRYPTO: 'Criptomoedas',
  FIXED_INCOME: 'Renda Fixa',
  OTHER: 'Outros',
};

const TYPE_COLORS: Record<string, string> = {
  STOCK: '#3b82f6',
  FII: '#10b981',
  ETF: '#8b5cf6',
  CRYPTO: '#f59e0b',
  FIXED_INCOME: '#06b6d4',
  OTHER: '#6b7280',
};

export const investmentService = {
  async list(userId: number) {
    return prisma.investment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async get(userId: number, id: number) {
    return prisma.investment.findFirst({ where: { id, userId } });
  },

  async create(userId: number, data: {
    name: string;
    ticker?: string;
    type: string;
    quantity: number;
    averagePrice: number;
    currentPrice?: number;
    targetPercent?: number;
    notes?: string;
  }) {
    return prisma.investment.create({
      data: {
        userId,
        name: data.name,
        ticker: data.ticker ?? null,
        type: data.type as never,
        quantity: data.quantity,
        averagePrice: data.averagePrice,
        currentPrice: data.currentPrice ?? null,
        targetPercent: data.targetPercent ?? null,
        notes: data.notes ?? null,
      },
    });
  },

  async update(userId: number, id: number, data: Partial<{
    name: string;
    ticker: string;
    type: string;
    quantity: number;
    averagePrice: number;
    currentPrice: number;
    targetPercent: number;
    notes: string;
  }>) {
    const existing = await prisma.investment.findFirst({ where: { id, userId } });
    if (!existing) return null;
    return prisma.investment.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.ticker !== undefined && { ticker: data.ticker }),
        ...(data.type !== undefined && { type: data.type as never }),
        ...(data.quantity !== undefined && { quantity: data.quantity }),
        ...(data.averagePrice !== undefined && { averagePrice: data.averagePrice }),
        ...(data.currentPrice !== undefined && { currentPrice: data.currentPrice }),
        ...(data.targetPercent !== undefined && { targetPercent: data.targetPercent }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
    });
  },

  async delete(userId: number, id: number) {
    const existing = await prisma.investment.findFirst({ where: { id, userId } });
    if (!existing) return null;
    await prisma.investment.delete({ where: { id } });
    return true;
  },

  async summary(userId: number) {
    const investments = await prisma.investment.findMany({ where: { userId } });

    let totalInvested = 0;
    let currentValue = 0;

    const byType = new Map<string, { label: string; color: string; invested: number; current: number; count: number }>();

    for (const inv of investments) {
      const qty = Number(inv.quantity);
      const avg = Number(inv.averagePrice);
      const cur = inv.currentPrice ? Number(inv.currentPrice) : avg;

      const invested = qty * avg;
      const current = qty * cur;

      totalInvested += invested;
      currentValue += current;

      const typeKey = inv.type;
      if (!byType.has(typeKey)) {
        byType.set(typeKey, {
          label: TYPE_LABELS[typeKey] ?? typeKey,
          color: TYPE_COLORS[typeKey] ?? '#6b7280',
          invested: 0,
          current: 0,
          count: 0,
        });
      }
      const entry = byType.get(typeKey)!;
      entry.invested += invested;
      entry.current += current;
      entry.count += 1;
    }

    const totalReturn = currentValue - totalInvested;
    const totalReturnPct = totalInvested > 0 ? (totalReturn / totalInvested) * 100 : 0;

    const allocation = Array.from(byType.entries()).map(([type, d]) => ({
      type,
      label: d.label,
      color: d.color,
      value: d.current,
      invested: d.invested,
      count: d.count,
      percent: currentValue > 0 ? (d.current / currentValue) * 100 : 0,
    }));

    const holdings = investments.map((inv) => {
      const qty = Number(inv.quantity);
      const avg = Number(inv.averagePrice);
      const cur = inv.currentPrice ? Number(inv.currentPrice) : avg;
      const invested = qty * avg;
      const current = qty * cur;
      const returnAbs = current - invested;
      const returnPct = invested > 0 ? (returnAbs / invested) * 100 : 0;
      return {
        id: inv.id,
        name: inv.name,
        ticker: inv.ticker,
        type: inv.type,
        typeLabel: TYPE_LABELS[inv.type] ?? inv.type,
        quantity: qty,
        averagePrice: avg,
        currentPrice: cur,
        invested,
        currentValue: current,
        returnAbs,
        returnPct,
        targetPercent: inv.targetPercent ? Number(inv.targetPercent) : null,
        currentPercent: currentValue > 0 ? (current / currentValue) * 100 : 0,
        notes: inv.notes,
      };
    });

    return {
      totalInvested,
      currentValue,
      totalReturn,
      totalReturnPct,
      count: investments.length,
      allocation,
      holdings,
    };
  },
};
