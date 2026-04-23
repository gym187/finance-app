import { z } from 'zod';

const FrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY']);
const TypeEnum = z.enum(['INCOME', 'EXPENSE']);

export const createRecurringSchema = z.object({
  description: z.string().min(1).max(200),
  amount: z.number().positive(),
  type: TypeEnum,
  categoryId: z.number().int().positive(),
  frequency: FrequencyEnum,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateRecurringSchema = createRecurringSchema
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;
export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
