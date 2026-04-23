import { z } from 'zod';

export const createGoalSchema = z.object({
  name: z.string().min(1).max(100),
  targetAmount: z.number().positive(),
  currentAmount: z.number().min(0).optional(),
  deadline: z.string().datetime().optional(),
  color: z.string().max(20).optional(),
  icon: z.string().max(50).optional(),
});

export const updateGoalSchema = createGoalSchema.partial().extend({
  isCompleted: z.boolean().optional(),
  deadline: z.string().datetime().nullable().optional(),
});

export const contributeSchema = z.object({
  amount: z.number().positive(),
});
