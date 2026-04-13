import { Response } from 'express';
import { transactionService } from '../services/transaction.service';
import {
  createTransactionSchema,
  updateTransactionSchema,
  transactionQuerySchema,
} from '../validators/transaction.validator';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const transactionController = {
  async create(req: AuthenticatedRequest, res: Response) {
    const data = createTransactionSchema.parse(req.body);
    const result = await transactionService.create(req.userId!, data);
    res.status(201).json({ success: true, data: result });
  },

  async findAll(req: AuthenticatedRequest, res: Response) {
    const query = transactionQuerySchema.parse(req.query);
    const result = await transactionService.findAll(req.userId!, query);
    res.json({ success: true, ...result });
  },

  async findById(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    const result = await transactionService.findById(req.userId!, id);
    res.json({ success: true, data: result });
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    const data = updateTransactionSchema.parse(req.body);
    const result = await transactionService.update(req.userId!, id, data);
    res.json({ success: true, data: result });
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    await transactionService.delete(req.userId!, id);
    res.json({ success: true, message: 'Transação excluída com sucesso' });
  },

  async exportCSV(req: AuthenticatedRequest, res: Response) {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    const csv = await transactionService.exportCSV(req.userId!, startDate, endDate);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="transacoes.csv"');
    res.send('\uFEFF' + csv); // BOM for Excel pt-BR
  },
};
