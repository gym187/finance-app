import { Response, NextFunction } from 'express';
import { goalService } from '../services/goal.service';
import { createGoalSchema, updateGoalSchema, contributeSchema } from '../validators/goal.validator';
import { AppError } from '../middleware/error.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export const goalController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await goalService.list(req.userId!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await goalService.get(req.userId!, id);
      if (!data) throw new AppError(404, 'Meta não encontrada');
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createGoalSchema.parse(req.body);
      const data = await goalService.create(req.userId!, parsed);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const parsed = updateGoalSchema.parse(req.body);
      const data = await goalService.update(req.userId!, id, parsed as never);
      if (!data) throw new AppError(404, 'Meta não encontrada');
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async contribute(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const { amount } = contributeSchema.parse(req.body);
      const data = await goalService.contribute(req.userId!, id, amount);
      if (!data) throw new AppError(404, 'Meta não encontrada');
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const ok = await goalService.delete(req.userId!, id);
      if (!ok) throw new AppError(404, 'Meta não encontrada');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
