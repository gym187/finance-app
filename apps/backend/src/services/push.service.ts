import webPush from 'web-push';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { logger } from '../config/logger';

if (env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  webPush.setVapidDetails(
    `mailto:${env.VAPID_EMAIL}`,
    env.VAPID_PUBLIC_KEY,
    env.VAPID_PRIVATE_KEY,
  );
}

export const pushService = {
  isEnabled() {
    return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
  },

  async subscribe(userId: number, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: sub.endpoint },
      update: { p256dh: sub.keys.p256dh, auth: sub.keys.auth, userId },
      create: { userId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    });
  },

  async unsubscribe(userId: number, endpoint: string) {
    await prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  },

  async sendToUser(userId: number, payload: { title: string; body: string; url?: string }) {
    if (!this.isEnabled()) return;
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    const expired: number[] = [];

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webPush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
          );
        } catch (err: any) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            expired.push(s.id);
          } else {
            logger.warn({ err, subId: s.id }, 'Erro ao enviar push');
          }
        }
      }),
    );

    if (expired.length > 0) {
      await prisma.pushSubscription.deleteMany({ where: { id: { in: expired } } });
    }
  },
};
