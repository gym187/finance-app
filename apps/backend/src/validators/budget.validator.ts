import { z } from 'zod';

export const createBudgetSchema = z.object({
  categoryId: z.number().int().positive().optional().nullable(),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Mês deve estar no formato YYYY-MM'),
  amount: z.number().positive('Valor deve ser positivo'),
  type: z.enum(['INCOME', 'EXPENSE', 'TOTAL']),
});

export const updateBudgetSchema = createBudgetSchema.partial();

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
