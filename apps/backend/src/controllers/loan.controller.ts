import { Response, NextFunction } from 'express';
import { loanService } from '../services/loan.service';
import { createLoanSchema, updateLoanSchema, payLoanSchema } from '../validators/loan.validator';
import { AppError } from '../middleware/error.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export const loanController = {
  async list(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await loanService.list(req.userId!);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async summary(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const data = await loanService.summary(req.userId!);
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async get(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await loanService.get(req.userId!, id);
      if (!data) throw new AppError(404, 'Empréstimo não encontrado');
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const parsed = createLoanSchema.parse(req.body);
      const data = await loanService.create(req.userId!, parsed);
      res.status(201).json({ success: true, data });
    } catch (err) { next(err); }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const parsed = updateLoanSchema.parse(req.body);
      const data = await loanService.update(req.userId!, id, parsed as never);
      if (!data) throw new AppError(404, 'Empréstimo não encontrado');
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async pay(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const { type } = payLoanSchema.parse(req.body);
      const data = await loanService.pay(req.userId!, id, type);
      if (!data) throw new AppError(404, 'Empréstimo não encontrado ou inativo');
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async payments(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await loanService.payments(req.userId!, id);
      if (!data) throw new AppError(404, 'Empréstimo não encontrado');
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async schedule(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const data = await loanService.schedule(req.userId!, id);
      if (!data) throw new AppError(404, 'Empréstimo não encontrado');
      res.json({ success: true, data });
    } catch (err) { next(err); }
  },

  async delete(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const id = parseInt(req.params.id, 10);
      const ok = await loanService.delete(req.userId!, id);
      if (!ok) throw new AppError(404, 'Empréstimo não encontrado');
      res.status(204).send();
    } catch (err) { next(err); }
  },
};
