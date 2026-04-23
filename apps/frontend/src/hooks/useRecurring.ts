'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export type RecurrencyFreq = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export const FREQ_LABELS: Record<RecurrencyFreq, string> = {
  DAILY: 'Diária',
  WEEKLY: 'Semanal',
  BIWEEKLY: 'Quinzenal',
  MONTHLY: 'Mensal',
};

export interface RecurringTransaction {
  id: number;
  userId: number;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  categoryId: number;
  frequency: RecurrencyFreq;
  startDate: string;
  endDate: string | null;
  nextDueDate: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: number; name: string; color: string | null; icon: string | null };
}

export function useRecurring() {
  return useQuery({
    queryKey: ['recurring'],
    queryFn: async () => {
      const res = await api.recurring.list();
      return (res as { success: boolean; data: RecurringTransaction[] }).data;
    },
  });
}

export function useRecurringMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['recurring'] });
    qc.invalidateQueries({ queryKey: ['transactions'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const create = useMutation({
    mutationFn: (data: unknown) => api.recurring.create(data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => api.recurring.update(id, data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.recurring.delete(id),
    onSuccess: invalidate,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      api.recurring.update(id, { isActive }),
    onSuccess: invalidate,
  });

  return { create, update, remove, toggle };
}
