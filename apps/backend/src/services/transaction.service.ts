import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, TransactionType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { budgetService } from './budget.service';
import { exchangeService } from './exchange.service';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../validators/transaction.validator';

const TAG_INCLUDE = {
  tags: { include: { tag: { select: { id: true, name: true, color: true } } } },
};

function shapeTags(tx: { tags: { tag: { id: number; name: string; color: string } }[] }) {
  return tx.tags.map((t) => t.tag);
}

export const transactionService = {
  async create(userId: number, data: CreateTransactionInput) {
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId },
    });
    if (!category) throw new AppError(404, 'Categoria não encontrada');

    const date = new Date(data.date);
    const currency = data.currency ?? 'BRL';
    const { amountBRL, rate } = await exchangeService.convertToBRL(data.amount, currency);
    const amount = data.type === 'EXPENSE' ? -Math.abs(amountBRL) : Math.abs(amountBRL);

    const tx = await prisma.transaction.create({
      data: {
        userId,
        description: data.description,
        amount: new Decimal(amount),
        type: data.type,
        categoryId: data.categoryId,
        date,
        currency,
        amountOriginal: currency !== 'BRL' ? new Decimal(data.amount) : null,
        exchangeRate: currency !== 'BRL' ? new Decimal(rate) : null,
        ...(data.tagIds?.length
          ? { tags: { create: data.tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      include: { category: true, ...TAG_INCLUDE },
    });

    if (data.type === 'EXPENSE') {
      budgetService.checkBudgetAlerts(userId, data.categoryId, date).catch(() => null);
    }

    return { ...tx, tags: shapeTags(tx) };
  },

  async findAll(
    userId: number,
    query: {
      page: number;
      limit: number;
      type?: string;
      categoryId?: number;
      tagId?: number;
      startDate?: string;
      endDate?: string;
      search?: string;
    }
  ) {
    const { page, limit, type, categoryId, tagId, startDate, endDate, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = { userId };
    if (type) where.type = type as TransactionType;
    if (categoryId) where.categoryId = categoryId;
    if (tagId) where.tags = { some: { tagId } };
    if (search) where.description = { contains: search, mode: 'insensitive' };
    if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate.includes('T') ? endDate : endDate + 'T23:59:59');
      where.date = dateFilter;
    }

    const [transactions, total] = await prisma.$transaction([
      prisma.transaction.findMany({
        where,
        include: { category: true, ...TAG_INCLUDE },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return {
      data: transactions.map((tx) => ({ ...tx, tags: shapeTags(tx) })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  },

  async findById(userId: number, id: number) {
    const tx = await prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true, ...TAG_INCLUDE },
    });
    if (!tx) throw new AppError(404, 'Transação não encontrada');
    return { ...tx, tags: shapeTags(tx) };
  },

  async update(userId: number, id: number, data: UpdateTransactionInput) {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Transação não encontrada');

    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) throw new AppError(404, 'Categoria não encontrada');
    }

    const resolvedType = data.type ?? existing.type;
    let amount: Decimal | undefined;
    let currency: string | undefined;
    let amountOriginal: Decimal | null | undefined;
    let exchangeRate: Decimal | null | undefined;

    if (data.amount !== undefined || data.currency !== undefined) {
      const newCurrency = data.currency ?? existing.currency;
      const rawAmount = data.amount ?? Math.abs(Number(existing.amountOriginal ?? existing.amount));
      const { amountBRL, rate } = await exchangeService.convertToBRL(rawAmount, newCurrency);
      const signed = resolvedType === 'EXPENSE' ? -Math.abs(amountBRL) : Math.abs(amountBRL);
      amount = new Decimal(signed);
      currency = newCurrency;
      amountOriginal = newCurrency !== 'BRL' ? new Decimal(rawAmount) : null;
      exchangeRate = newCurrency !== 'BRL' ? new Decimal(rate) : null;
    }

    const tx = await prisma.transaction.update({
      where: { id },
      data: {
        description: data.description,
        amount,
        type: data.type,
        categoryId: data.categoryId,
        date: data.date ? new Date(data.date) : undefined,
        ...(currency !== undefined ? { currency, amountOriginal, exchangeRate } : {}),
        ...(data.tagIds !== undefined
          ? { tags: { deleteMany: {}, create: data.tagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      include: { category: true, ...TAG_INCLUDE },
    });

    if (tx.type === 'EXPENSE') {
      budgetService
        .checkBudgetAlerts(
          userId,
          data.categoryId ?? existing.categoryId,
          data.date ? new Date(data.date) : existing.date
        )
        .catch(() => null);
    }

    return { ...tx, tags: shapeTags(tx) };
  },

  async delete(userId: number, id: number) {
    const existing = await prisma.transaction.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Transação não encontrada');
    await prisma.transaction.delete({ where: { id } });
  },

  async exportCSV(userId: number, startDate?: string, endDate?: string): Promise<string> {
    const where: Prisma.TransactionWhereInput = { userId };
    if (startDate || endDate) {
      const dateFilter: Prisma.DateTimeFilter = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate.includes('T') ? endDate : endDate + 'T23:59:59');
      where.date = dateFilter;
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: { category: true, ...TAG_INCLUDE },
      orderBy: { date: 'desc' },
    });

    const header = 'Data,Descrição,Tipo,Moeda,Valor Original,Valor BRL,Câmbio,Categoria,Tags\n';
    const rows = transactions.map((t) => {
      const date = t.date.toISOString().substring(0, 10);
      const amountBRL = Math.abs(Number(t.amount)).toFixed(2).replace('.', ',');
      const amountOrig = t.amountOriginal
        ? Math.abs(Number(t.amountOriginal)).toFixed(t.currency === 'BTC' ? 8 : 2).replace('.', ',')
        : amountBRL;
      const rate = t.exchangeRate ? Number(t.exchangeRate).toFixed(4).replace('.', ',') : '1,0000';
      const desc = t.description.replace(/"/g, '""');
      const tags = t.tags.map((tt) => tt.tag.name).join('|');
      return `${date},"${desc}",${t.type === 'INCOME' ? 'Entrada' : 'Saída'},${t.currency},${amountOrig},${amountBRL},${rate},"${t.category?.name ?? ''}","${tags}"`;
    });

    return header + rows.join('\n');
  },
};
