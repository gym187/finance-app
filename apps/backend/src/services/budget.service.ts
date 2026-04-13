import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { CreateBudgetInput, UpdateBudgetInput } from '../validators/budget.validator';

export const budgetService = {
  async create(userId: number, data: CreateBudgetInput) {
    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) throw new AppError(404, 'Categoria não encontrada');
    }

    return prisma.budget.create({
      data: {
        userId,
        categoryId: data.categoryId ?? null,
        month: data.month,
        amount: new Decimal(data.amount),
        type: data.type,
      },
      include: { category: true },
    });
  },

  async findAll(userId: number, month?: string) {
    return prisma.budget.findMany({
      where: { userId, ...(month ? { month } : {}) },
      include: { category: true },
      orderBy: [{ type: 'asc' }, { id: 'asc' }],
    });
  },

  async findById(userId: number, id: number) {
    const budget = await prisma.budget.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!budget) throw new AppError(404, 'Orçamento não encontrado');
    return budget;
  },

  async update(userId: number, id: number, data: UpdateBudgetInput) {
    const existing = await prisma.budget.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Orçamento não encontrado');

    if (data.categoryId) {
      const category = await prisma.category.findFirst({
        where: { id: data.categoryId, userId },
      });
      if (!category) throw new AppError(404, 'Categoria não encontrada');
    }

    return prisma.budget.update({
      where: { id },
      data: {
        categoryId: data.categoryId,
        month: data.month,
        amount: data.amount ? new Decimal(data.amount) : undefined,
        type: data.type,
      },
      include: { category: true },
    });
  },

  async delete(userId: number, id: number) {
    const existing = await prisma.budget.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Orçamento não encontrado');
    await prisma.budget.delete({ where: { id } });
  },
};
