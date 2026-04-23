import { Response, NextFunction } from 'express';
import { importService } from '../services/import.service';
import { AppError } from '../middleware/error.middleware';
import type { AuthenticatedRequest } from '../middleware/auth.middleware';

export const importController = {
  async parse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      if (!req.file) throw new AppError(400, 'Arquivo CSV não enviado');

      const csvText = req.file.buffer.toString('utf-8');
      const result = await importService.parseCSV(req.userId!, csvText);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },

  async confirm(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { rows } = req.body as {
        rows: {
          date: string;
          description: string;
          amount: number;
          type: 'INCOME' | 'EXPENSE';
          categoryId: number;
        }[];
      };

      if (!Array.isArray(rows) || rows.length === 0) {
        throw new AppError(400, 'Nenhuma linha para importar');
      }

      const invalidRow = rows.find((r) => !r.categoryId);
      if (invalidRow) throw new AppError(400, 'Todas as linhas precisam de uma categoria');

      const result = await importService.confirmImport(req.userId!, rows);
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  },
};
