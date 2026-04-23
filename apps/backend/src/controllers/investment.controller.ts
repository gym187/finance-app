import { Response, NextFunction } from 'express';
import { investmentService } from '../services/investment.service';
import { createInvestmentSchema, updateInvestmentSchema } from '../validators/investment.validator';
import { AppError } from '../middleware/error.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export const investmentController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await investmentService.list(req.userId!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async summary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await investmentService.summary(req.userId!);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await investmentService.get(req.userId!, id);
      if (!data) throw new AppError(404, 'Investimento não encontrado');
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createInvestmentSchema.parse(req.body);
      const data = await investmentService.create(req.userId!, parsed);
      res.status(201).json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const parsed = updateInvestmentSchema.parse(req.body);
      const data = await investmentService.update(req.userId!, id, parsed);
      if (!data) throw new AppError(404, 'Investimento não encontrado');
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const ok = await investmentService.delete(req.userId!, id);
      if (!ok) throw new AppError(404, 'Investimento não encontrado');
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
