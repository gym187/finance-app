import { Decimal } from '@prisma/client/runtime/library';
import { Prisma, TransactionType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import {
  CreateTransactionInput,
  UpdateTransactionInput,
} from '../validators/transaction.validator';

export const transactionService = {
  async create(userId: number, data: CreateTransactionInput) {
    // Verify category belongs to this user
    const category = await prisma.category.findFirst({
      where: { id: data.categoryId, userId },
    });
    if (!category) {
      throw new AppError(404, 'Categoria não encontrada');
    }

    // Income → positive, Expense → negative
    const amount = data.type === 'EXPENSE' ? -Math.abs(data.amount) : Math.abs(data.amount);

    return prisma.transaction.create({
      data: {
        userId,
        description: data.description,
        amount: new Decimal(amount),
        type: data.type,
        categoryId: data.categoryId,
        date: new Date(data.date),
      },
      include: { category: true },
    });
  },

  async findAll(
    userId: number,
    query: {
      page: number;
      limit: number;
      type?: string;
      categoryId?: number;
      startDate?: string;
      endDate?: string;
      search?: string;
    }
  ) {
    const { page, limit, type, categoryId, startDate, endDate, search } = query;
    const skip = (page - 1) * limit;

    const where: Prisma.TransactionWhereInput = { userId };
    if (type) where.type = type as TransactionType;
    if (categoryId) where.categoryId = categoryId;
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
        include: { category: true },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { data: transactions, total, page, limit, totalPages: Math.ceil(total / limit) };
  },

  async findById(userId: number, id: number) {
    const tx = await prisma.transaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!tx) throw new AppError(404, 'Transação não encontrada');
    return tx;
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
    if (data.amount !== undefined) {
      const raw =
        resolvedType === 'EXPENSE' ? -Math.abs(data.amount) : Math.abs(data.amount);
      amount = new Decimal(raw);
    }

    return prisma.transaction.update({
      where: { id },
      data: {
        description: data.description,
        amount,
        type: data.type,
        categoryId: data.categoryId,
        date: data.date ? new Date(data.date) : undefined,
      },
      include: { category: true },
    });
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
      include: { category: true },
      orderBy: { date: 'desc' },
    });

    const header = 'Data,Descrição,Tipo,Valor,Categoria\n';
    const rows = transactions.map((t) => {
      const date = t.date.toISOString().substring(0, 10);
      const amount = Math.abs(Number(t.amount)).toFixed(2).replace('.', ',');
      const desc = t.description.replace(/"/g, '""');
      return `${date},"${desc}",${t.type === 'INCOME' ? 'Entrada' : 'Saída'},${amount},"${t.category?.name ?? ''}"`;
    });

    return header + rows.join('\n');
  },
};
