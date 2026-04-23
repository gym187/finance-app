import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { notificationService } from './notification.service';

export const goalService = {
  async list(userId: number) {
    return prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  },

  async get(userId: number, id: number) {
    return prisma.savingsGoal.findFirst({ where: { id, userId } });
  },

  async create(userId: number, data: {
    name: string;
    targetAmount: number;
    currentAmount?: number;
    deadline?: string;
    color?: string;
    icon?: string;
  }) {
    return prisma.savingsGoal.create({
      data: {
        userId,
        name: data.name,
        targetAmount: data.targetAmount,
        currentAmount: data.currentAmount ?? 0,
        deadline: data.deadline ? new Date(data.deadline) : null,
        color: data.color ?? null,
        icon: data.icon ?? null,
      },
    });
  },

  async update(userId: number, id: number, data: Partial<{
    name: string;
    targetAmount: number;
    currentAmount: number;
    deadline: string | null;
    color: string;
    icon: string;
    isCompleted: boolean;
  }>) {
    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) return null;

    return prisma.savingsGoal.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.targetAmount !== undefined && { targetAmount: data.targetAmount }),
        ...(data.currentAmount !== undefined && { currentAmount: data.currentAmount }),
        ...(data.deadline !== undefined && { deadline: data.deadline ? new Date(data.deadline) : null }),
        ...(data.color !== undefined && { color: data.color }),
        ...(data.icon !== undefined && { icon: data.icon }),
        ...(data.isCompleted !== undefined && { isCompleted: data.isCompleted }),
      },
    });
  },

  async contribute(userId: number, id: number, amount: number) {
    const goal = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!goal) return null;

    const newAmount = Number(goal.currentAmount) + amount;
    const isCompleted = newAmount >= Number(goal.targetAmount);
    const wasCompleted = goal.isCompleted;

    const updated = await prisma.savingsGoal.update({
      where: { id },
      data: { currentAmount: newAmount, isCompleted },
    });

    if (isCompleted && !wasCompleted) {
      notificationService
        .create(userId, {
          title: 'Meta atingida! 🎯',
          body: `Parabéns! Você atingiu a meta "${goal.name}" de R$ ${Number(goal.targetAmount).toFixed(2)}.`,
          type: 'GOAL_REACHED',
          link: '/goals',
        })
        .catch(() => {});
    }

    return updated;
  },

  async delete(userId: number, id: number) {
    const existing = await prisma.savingsGoal.findFirst({ where: { id, userId } });
    if (!existing) return null;
    await prisma.savingsGoal.delete({ where: { id } });
    return true;
  },
};
