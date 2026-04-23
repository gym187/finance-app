import { NotificationType } from '@prisma/client';
import { prisma } from '../config/prisma';
import { pushService } from './push.service';

export const notificationService = {
  async create(
    userId: number,
    data: { title: string; body: string; type: NotificationType; link?: string },
  ) {
    const notif = await prisma.appNotification.create({ data: { userId, ...data } });
    pushService
      .sendToUser(userId, { title: data.title, body: data.body, url: data.link })
      .catch(() => {});
    return notif;
  },

  async list(userId: number) {
    return prisma.appNotification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  },

  async unreadCount(userId: number) {
    return prisma.appNotification.count({ where: { userId, read: false } });
  },

  async markRead(userId: number, id: number) {
    await prisma.appNotification.updateMany({ where: { id, userId }, data: { read: true } });
  },

  async markAllRead(userId: number) {
    await prisma.appNotification.updateMany({ where: { userId, read: false }, data: { read: true } });
  },

  async delete(userId: number, id: number) {
    await prisma.appNotification.deleteMany({ where: { id, userId } });
  },

  async checkLoanDueAlerts() {
    const threeDaysFromNow = new Date();
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const loans = await prisma.loan.findMany({
      where: {
        isActive: true,
        dueDayOfMonth: {
          gte: today.getDate(),
          lte: threeDaysFromNow.getDate(),
        },
      },
      include: { user: { select: { id: true } } },
    });

    for (const loan of loans) {
      const existing = await prisma.appNotification.findFirst({
        where: {
          userId: loan.userId,
          type: 'LOAN_DUE',
          link: `/loans`,
          createdAt: { gte: new Date(today.getFullYear(), today.getMonth(), 1) },
        },
      });
      if (!existing) {
        await this.create(loan.userId, {
          title: 'Vencimento de empréstimo',
          body: `"${loan.name}" vence em ${loan.dueDayOfMonth}/${String(today.getMonth() + 1).padStart(2, '0')}. Saldo: R$ ${Number(loan.currentBalance).toFixed(2)}.`,
          type: 'LOAN_DUE',
          link: '/loans',
        });
      }
    }
  },
};
