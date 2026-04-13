import { Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const dashboardController = {
  async getData(req: AuthenticatedRequest, res: Response) {
    const result = await dashboardService.getData(req.userId!);
    res.json({ success: true, data: result });
  },
};
