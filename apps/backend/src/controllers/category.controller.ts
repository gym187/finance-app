import { Response } from 'express';
import { categoryService } from '../services/category.service';
import {
  createCategorySchema,
  updateCategorySchema,
} from '../validators/category.validator';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const categoryController = {
  async create(req: AuthenticatedRequest, res: Response) {
    const data = createCategorySchema.parse(req.body);
    const result = await categoryService.create(req.userId!, data);
    res.status(201).json({ success: true, data: result });
  },

  async findAll(req: AuthenticatedRequest, res: Response) {
    const result = await categoryService.findAll(req.userId!);
    res.json({ success: true, data: result });
  },

  async findById(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    const result = await categoryService.findById(req.userId!, id);
    res.json({ success: true, data: result });
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    const data = updateCategorySchema.parse(req.body);
    const result = await categoryService.update(req.userId!, id, data);
    res.json({ success: true, data: result });
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    await categoryService.delete(req.userId!, id);
    res.json({ success: true, message: 'Categoria excluída com sucesso' });
  },
};
