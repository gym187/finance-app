import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { CreateCategoryInput, UpdateCategoryInput } from '../validators/category.validator';

export const categoryService = {
  async create(userId: number, data: CreateCategoryInput) {
    return prisma.category.create({ data: { ...data, userId } });
  },

  async findAll(userId: number) {
    return prisma.category.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  },

  async findById(userId: number, id: number) {
    const category = await prisma.category.findFirst({ where: { id, userId } });
    if (!category) throw new AppError(404, 'Categoria não encontrada');
    return category;
  },

  async update(userId: number, id: number, data: UpdateCategoryInput) {
    const existing = await prisma.category.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Categoria não encontrada');
    return prisma.category.update({ where: { id }, data });
  },

  async delete(userId: number, id: number) {
    const existing = await prisma.category.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Categoria não encontrada');

    const transactionCount = await prisma.transaction.count({ where: { categoryId: id } });
    if (transactionCount > 0) {
      throw new AppError(
        409,
        `Não é possível excluir: categoria possui ${transactionCount} transação(ões) vinculada(s)`
      );
    }

    await prisma.category.delete({ where: { id } });
  },
};
