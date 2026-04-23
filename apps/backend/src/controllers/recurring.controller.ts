import { Response, NextFunction } from 'express';
import { recurringService } from '../services/recurring.service';
import { createRecurringSchema, updateRecurringSchema } from '../validators/recurring.validator';
import { AppError } from '../middleware/error.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export const recurringController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await recurringService.list(req.userId!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await recurringService.get(req.userId!, id);
      if (!data) throw new AppError(404, 'Recorrência não encontrada');
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createRecurringSchema.parse(req.body);
      const data = await recurringService.create(req.userId!, parsed);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const parsed = updateRecurringSchema.parse(req.body);
      const data = await recurringService.update(req.userId!, id, parsed);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      await recurringService.delete(req.userId!, id);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
