import { z } from 'zod';

const InvestmentTypeEnum = z.enum(['STOCK', 'FII', 'ETF', 'CRYPTO', 'FIXED_INCOME', 'OTHER']);

export const createInvestmentSchema = z.object({
  name: z.string().min(1).max(100),
  ticker: z.string().max(20).optional(),
  type: InvestmentTypeEnum,
  quantity: z.number().positive(),
  averagePrice: z.number().positive(),
  currentPrice: z.number().positive().optional(),
  targetPercent: z.number().min(0).max(100).optional(),
  notes: z.string().max(500).optional(),
});

export const updateInvestmentSchema = createInvestmentSchema.partial();
