import { Decimal } from '@prisma/client/runtime/library';
import { addDays, addWeeks, addMonths, startOfDay, isBefore, isAfter } from 'date-fns';
import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import type { CreateRecurringInput, UpdateRecurringInput } from '../validators/recurring.validator';

type Frequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

function nextDate(from: Date, frequency: Frequency): Date {
  switch (frequency) {
    case 'DAILY':    return addDays(from, 1);
    case 'WEEKLY':   return addWeeks(from, 1);
    case 'BIWEEKLY': return addWeeks(from, 2);
    case 'MONTHLY':  return addMonths(from, 1);
  }
}

export const recurringService = {
  async list(userId: number) {
    return prisma.recurringTransaction.findMany({
      where: { userId },
      include: { category: true },
      orderBy: [{ isActive: 'desc' }, { nextDueDate: 'asc' }],
    });
  },

  async get(userId: number, id: number) {
    return prisma.recurringTransaction.findFirst({
      where: { id, userId },
      include: { category: true },
    });
  },

  async create(userId: number, data: CreateRecurringInput) {
    const category = await prisma.category.findFirst({ where: { id: data.categoryId, userId } });
    if (!category) throw new AppError(404, 'Categoria não encontrada');

    const startDate = startOfDay(new Date(data.startDate));
    const endDate = data.endDate ? startOfDay(new Date(data.endDate)) : null;

    const created = await prisma.recurringTransaction.create({
      data: {
        userId,
        description: data.description,
        amount: new Decimal(data.amount),
        type: data.type,
        categoryId: data.categoryId,
        frequency: data.frequency,
        startDate,
        endDate,
        nextDueDate: startDate,
        isActive: true,
      },
      include: { category: true },
    });

    // Generate any transactions due immediately (e.g. startDate = today)
    await recurringService.processDue();

    return created;
  },

  async update(userId: number, id: number, data: UpdateRecurringInput) {
    const existing = await prisma.recurringTransaction.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Recorrência não encontrada');

    const updateData: Record<string, unknown> = {};
    if (data.description !== undefined) updateData.description = data.description;
    if (data.amount !== undefined) updateData.amount = new Decimal(data.amount);
    if (data.type !== undefined) updateData.type = data.type;
    if (data.categoryId !== undefined) {
      const cat = await prisma.category.findFirst({ where: { id: data.categoryId, userId } });
      if (!cat) throw new AppError(404, 'Categoria não encontrada');
      updateData.categoryId = data.categoryId;
    }
    if (data.frequency !== undefined) updateData.frequency = data.frequency;
    if (data.startDate !== undefined) updateData.startDate = startOfDay(new Date(data.startDate));
    if (data.endDate !== undefined) updateData.endDate = startOfDay(new Date(data.endDate));
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return prisma.recurringTransaction.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });
  },

  async delete(userId: number, id: number) {
    const existing = await prisma.recurringTransaction.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Recorrência não encontrada');
    await prisma.recurringTransaction.delete({ where: { id } });
    return true;
  },

  // Processes all due recurring transactions for all users (runs on interval)
  async processDue() {
    const today = startOfDay(new Date());

    const due = await prisma.recurringTransaction.findMany({
      where: {
        isActive: true,
        nextDueDate: { lte: today },
      },
    });

    let generated = 0;

    for (const rec of due) {
      let current = startOfDay(rec.nextDueDate);

      // Generate all overdue occurrences (catch-up)
      while (!isAfter(current, today)) {
        // Skip if past endDate
        if (rec.endDate && isAfter(current, startOfDay(rec.endDate))) break;

        const amount =
          rec.type === 'EXPENSE'
            ? new Decimal(-Math.abs(Number(rec.amount)))
            : new Decimal(Math.abs(Number(rec.amount)));

        await prisma.transaction.create({
          data: {
            userId: rec.userId,
            description: rec.description,
            amount,
            type: rec.type,
            categoryId: rec.categoryId,
            date: current,
          },
        });

        generated++;
        current = nextDate(current, rec.frequency as Frequency);
      }

      // Check if recurring has expired
      const expired = rec.endDate && isAfter(startOfDay(new Date()), startOfDay(rec.endDate));

      await prisma.recurringTransaction.update({
        where: { id: rec.id },
        data: {
          nextDueDate: current,
          isActive: expired ? false : rec.isActive,
        },
      });
    }

    return generated;
  },
};
