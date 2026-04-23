import { Response } from 'express';
import { AuthenticatedRequest as Request } from '../middleware/auth.middleware';
import { notificationService } from '../services/notification.service';

export const notificationController = {
  async list(req: Request, res: Response) {
    const [notifications, unread] = await Promise.all([
      notificationService.list(req.userId!),
      notificationService.unreadCount(req.userId!),
    ]);
    res.json({ data: { notifications, unread } });
  },

  async markRead(req: Request, res: Response) {
    await notificationService.markRead(req.userId!, Number(req.params.id));
    res.json({ ok: true });
  },

  async markAllRead(req: Request, res: Response) {
    await notificationService.markAllRead(req.userId!);
    res.json({ ok: true });
  },

  async delete(req: Request, res: Response) {
    await notificationService.delete(req.userId!, Number(req.params.id));
    res.json({ ok: true });
  },
};
