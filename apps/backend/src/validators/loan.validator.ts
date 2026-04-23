import { z } from 'zod';

export const createLoanSchema = z.object({
  name: z.string().min(1).max(100),
  principalAmount: z.number().positive(),
  interestRate: z.number().min(0).max(100),
  startDate: z.string().datetime(),
  dueDayOfMonth: z.number().int().min(1).max(28),
  installments: z.number().int().positive().optional(),
  notes: z.string().max(500).optional(),
});

export const updateLoanSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  interestRate: z.number().min(0).max(100).optional(),
  dueDayOfMonth: z.number().int().min(1).max(28).optional(),
  installments: z.number().int().positive().nullable().optional(),
  notes: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const payLoanSchema = z.object({
  type: z.enum(['FULL', 'INTEREST_ONLY']),
});
