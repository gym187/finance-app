import { Response } from 'express';
import { budgetService } from '../services/budget.service';
import { createBudgetSchema, updateBudgetSchema } from '../validators/budget.validator';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const budgetController = {
  async create(req: AuthenticatedRequest, res: Response) {
    const data = createBudgetSchema.parse(req.body);
    const result = await budgetService.create(req.userId!, data);
    res.status(201).json({ success: true, data: result });
  },

  async findAll(req: AuthenticatedRequest, res: Response) {
    const { month } = req.query as { month?: string };
    const result = await budgetService.findAll(req.userId!, month);
    res.json({ success: true, data: result });
  },

  async findById(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    const result = await budgetService.findById(req.userId!, id);
    res.json({ success: true, data: result });
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    const data = updateBudgetSchema.parse(req.body);
    const result = await budgetService.update(req.userId!, id, data);
    res.json({ success: true, data: result });
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    await budgetService.delete(req.userId!, id);
    res.json({ success: true, message: 'Orçamento excluído com sucesso' });
  },
};
