import { prisma } from '../config/prisma';
import { AppError } from '../middleware/error.middleware';
import { CreateTagInput, UpdateTagInput } from '../validators/tag.validator';

export const tagService = {
  async findAll(userId: number) {
    return prisma.tag.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    });
  },

  async create(userId: number, data: CreateTagInput) {
    const existing = await prisma.tag.findUnique({
      where: { userId_name: { userId, name: data.name } },
    });
    if (existing) throw new AppError(409, 'Tag com esse nome já existe');

    return prisma.tag.create({ data: { ...data, userId } });
  },

  async update(userId: number, id: number, data: UpdateTagInput) {
    const existing = await prisma.tag.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Tag não encontrada');

    if (data.name && data.name !== existing.name) {
      const conflict = await prisma.tag.findUnique({
        where: { userId_name: { userId, name: data.name } },
      });
      if (conflict) throw new AppError(409, 'Tag com esse nome já existe');
    }

    return prisma.tag.update({ where: { id }, data });
  },

  async delete(userId: number, id: number) {
    const existing = await prisma.tag.findFirst({ where: { id, userId } });
    if (!existing) throw new AppError(404, 'Tag não encontrada');
    await prisma.tag.delete({ where: { id } });
  },
};
