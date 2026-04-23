import { Response } from 'express';
import { AuthenticatedRequest as Request } from '../middleware/auth.middleware';
import { env } from '../config/env';
import { pushService } from '../services/push.service';

export const pushController = {
  getVapidKey(_req: Request, res: Response) {
    res.json({ publicKey: env.VAPID_PUBLIC_KEY ?? null });
  },

  async subscribe(req: Request, res: Response) {
    const { endpoint, keys } = req.body ?? {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Subscription inválida' });
    }
    const sub = await pushService.subscribe(req.userId!, { endpoint, keys });
    res.json({ data: sub });
  },

  async unsubscribe(req: Request, res: Response) {
    const { endpoint } = req.body ?? {};
    if (!endpoint) return res.status(400).json({ error: 'endpoint obrigatório' });
    await pushService.unsubscribe(req.userId!, endpoint);
    res.json({ ok: true });
  },
};
