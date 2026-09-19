import { prisma } from '../config/prisma';

export const settingsService = {
  async get(userId: number) {
    return prisma.userSettings.findUnique({ where: { userId } });
  },

  async upsert(userId: number, data: { investmentTarget?: number | null }) {
    return prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        investmentTarget: data.investmentTarget ?? null,
      },
      update: {
        ...(data.investmentTarget !== undefined && {
          investmentTarget: data.investmentTarget,
        }),
      },
    });
  },
};
