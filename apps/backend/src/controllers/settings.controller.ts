import { Response } from 'express';
import { settingsService } from '../services/settings.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const settingsController = {
  async get(req: AuthenticatedRequest, res: Response) {
    const settings = await settingsService.get(req.userId!);
    res.json({ success: true, data: settings ?? {} });
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const { investmentTarget } = req.body as { investmentTarget?: number | null };
    const settings = await settingsService.upsert(req.userId!, { investmentTarget });
    res.json({ success: true, data: settings });
  },
};
