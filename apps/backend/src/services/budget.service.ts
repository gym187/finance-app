import { Decimal } from '@prisma/client/runtime/library';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { logger } from '../config/logger';
import { emailService } from './email.service';
import { notificationService } from './notification.service';
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

  async checkBudgetAlerts(userId: number, categoryId: number, date: Date) {
    const month = format(date, 'yyyy-MM');

    const budget = await prisma.budget.findFirst({
      where: { userId, categoryId, month, type: 'EXPENSE' },
      include: { category: true },
    });
    if (!budget) return;

    const spending = await prisma.transaction.aggregate({
      where: {
        userId,
        categoryId,
        type: 'EXPENSE',
        date: { gte: startOfMonth(date), lte: endOfMonth(date) },
      },
      _sum: { amount: true },
    });

    const spent = Math.abs(Number(spending._sum.amount ?? 0));
    const limit = Number(budget.amount);
    const pct = limit > 0 ? (spent / limit) * 100 : 0;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    if (!user) return;

    const categoryName = budget.category?.name ?? 'Categoria';
    const monthLabel = format(date, 'MM/yyyy');

    const fmt = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    if (pct >= 100 && !budget.alerted100) {
      await prisma.budget.update({ where: { id: budget.id }, data: { alerted100: true } });
      emailService
        .sendBudgetAlert(user.email, {
          userName: user.name ?? 'Usuário',
          categoryName,
          month: monthLabel,
          spent,
          limit,
          percent: pct,
          level: 100,
        })
        .catch((err) => logger.error({ err }, 'Erro ao enviar alerta de orçamento 100%'));
      notificationService
        .create(userId, {
          title: `Orçamento estourado — ${categoryName}`,
          body: `Você gastou ${fmt(spent)} de ${fmt(limit)} em ${categoryName} (${monthLabel}).`,
          type: 'BUDGET_ALERT',
          link: '/budgets',
        })
        .catch(() => {});
    } else if (pct >= 80 && !budget.alerted80) {
      await prisma.budget.update({ where: { id: budget.id }, data: { alerted80: true } });
      emailService
        .sendBudgetAlert(user.email, {
          userName: user.name ?? 'Usuário',
          categoryName,
          month: monthLabel,
          spent,
          limit,
          percent: pct,
          level: 80,
        })
        .catch((err) => logger.error({ err }, 'Erro ao enviar alerta de orçamento 80%'));
      notificationService
        .create(userId, {
          title: `Alerta de orçamento — ${categoryName}`,
          body: `Você atingiu ${Math.round(pct)}% do orçamento de ${categoryName} em ${monthLabel}.`,
          type: 'BUDGET_ALERT',
          link: '/budgets',
        })
        .catch(() => {});
    }
  },
};
