import { Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { recurringService } from '../services/recurring.service';
import { projectionService } from '../services/projection.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const dashboardController = {
  async getData(req: AuthenticatedRequest, res: Response) {
    await recurringService.processDue();
    const result = await dashboardService.getData(req.userId!);
    res.json({ success: true, data: result });
  },

  async getProjection(req: AuthenticatedRequest, res: Response) {
    const result = await projectionService.getProjection(req.userId!);
    res.json({ success: true, data: result });
  },
};
