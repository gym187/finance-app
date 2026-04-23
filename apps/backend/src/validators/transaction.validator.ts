import { z } from 'zod';

export const createTransactionSchema = z.object({
  description: z.string().min(1, 'Descrição é obrigatória').max(255),
  amount: z.number().positive('Valor deve ser positivo'),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.number().int().positive('Categoria inválida'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T.*)?$/, 'Data inválida'),
  currency: z.enum(['BRL', 'USD', 'EUR', 'GBP', 'BTC']).default('BRL'),
  tagIds: z.array(z.number().int().positive()).optional(),
});

export const updateTransactionSchema = createTransactionSchema.partial();

export const transactionQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? Math.min(parseInt(v, 10), 100) : 20)),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  categoryId: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined)),
  tagId: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : undefined)),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
});

// z.input preserves optionality of fields with .default() — currency can be omitted
export type CreateTransactionInput = z.input<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;
