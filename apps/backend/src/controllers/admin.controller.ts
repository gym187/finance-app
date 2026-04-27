import { Response } from 'express';
import { z } from 'zod';
import { adminService } from '../services/admin.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
  document: z.string().optional(),
  companyName: z.string().optional(),
  planSlug: z.string().optional(),
});

const updateUserSchema = z.object({
  name: z.string().optional(),
  phone: z.string().optional(),
  document: z.string().optional(),
  companyName: z.string().optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
});

const updateSubscriptionSchema = z.object({
  status: z.enum(['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED']).optional(),
  endDate: z.string().nullable().optional(),
  planSlug: z.string().optional(),
  notes: z.string().optional(),
});

const planSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  price: z.number().min(0),
  trialDays: z.number().int().min(0).optional(),
});

export const adminController = {
  async getMetrics(_req: AuthenticatedRequest, res: Response) {
    const data = await adminService.getMetrics();
    res.json({ success: true, data });
  },

  async listUsers(req: AuthenticatedRequest, res: Response) {
    const { search, status, page, limit } = req.query as Record<string, string>;
    const data = await adminService.listUsers({
      search,
      status,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
    });
    res.json({ success: true, data });
  },

  async getUser(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    const data = await adminService.getUser(id);
    res.json({ success: true, data });
  },

  async createUser(req: AuthenticatedRequest, res: Response) {
    const data = createUserSchema.parse(req.body);
    const user = await adminService.createUser(data);
    res.status(201).json({ success: true, data: user });
  },

  async updateUser(req: AuthenticatedRequest, res: Response) {
    const id = parseInt(req.params.id, 10);
    const data = updateUserSchema.parse(req.body);
    const user = await adminService.updateUser(req.userId!, id, data);
    res.json({ success: true, data: user });
  },

  async updateSubscription(req: AuthenticatedRequest, res: Response) {
    const userId = parseInt(req.params.id, 10);
    const data = updateSubscriptionSchema.parse(req.body);
    const sub = await adminService.updateSubscription(req.userId!, userId, data);
    res.json({ success: true, data: sub });
  },

  async listPlans(_req: AuthenticatedRequest, res: Response) {
    const data = await adminService.listPlans();
    res.json({ success: true, data });
  },

  async upsertPlan(req: AuthenticatedRequest, res: Response) {
    const data = planSchema.parse(req.body);
    const plan = await adminService.upsertPlan(data);
    res.json({ success: true, data: plan });
  },
};
