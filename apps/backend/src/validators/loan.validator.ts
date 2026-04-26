import { z } from 'zod';

export const createLoanSchema = z.object({
  type: z.enum(['LOAN', 'CREDIT_CARD', 'BOLETO']).default('LOAN'),
  name: z.string().min(1).max(100),
  principalAmount: z.number().positive(),
  categoryId: z.number().int().positive().optional(),
  // LOAN / CREDIT_CARD
  interestRate: z.number().min(0).max(100).optional(),
  startDate: z.string().datetime().optional(),
  dueDayOfMonth: z.number().int().min(1).max(28).optional(),
  closingDay: z.number().int().min(1).max(28).optional(),
  installments: z.number().int().positive().optional(),
  // BOLETO
  dueDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional(),
});

export const updateLoanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  categoryId: z.number().int().positive().nullable().optional(),
  interestRate: z.number().min(0).max(100).optional(),
  dueDayOfMonth: z.number().int().min(1).max(28).optional(),
  closingDay: z.number().int().min(1).max(28).optional(),
  dueDate: z.string().datetime().optional(),
  installments: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const payLoanSchema = z.object({
  type: z.enum(['FULL', 'INTEREST_ONLY']),
});

export type CreateLoanInput = z.infer<typeof createLoanSchema>;
export type UpdateLoanInput = z.infer<typeof updateLoanSchema>;
