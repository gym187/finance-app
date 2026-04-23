import { Response } from 'express';
import { tagService } from '../services/tag.service';
import { createTagSchema, updateTagSchema } from '../validators/tag.validator';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export const tagController = {
  async findAll(req: AuthenticatedRequest, res: Response) {
    const tags = await tagService.findAll(req.userId!);
    res.json({ success: true, data: tags });
  },

  async create(req: AuthenticatedRequest, res: Response) {
    const data = createTagSchema.parse(req.body);
    const tag = await tagService.create(req.userId!, data);
    res.status(201).json({ success: true, data: tag });
  },

  async update(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    const data = updateTagSchema.parse(req.body);
    const tag = await tagService.update(req.userId!, id, data);
    res.json({ success: true, data: tag });
  },

  async delete(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    await tagService.delete(req.userId!, id);
    res.json({ success: true, message: 'Tag excluída com sucesso' });
  },
};
