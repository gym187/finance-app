import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Transaction, PaginatedResponse } from '@finance-app/shared';

interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: string;
  categoryId?: number;
  tagId?: number | string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export function useTransactions(filters: TransactionFilters = {}) {
  const params: Record<string, string> = {};
  if (filters.page) params.page = String(filters.page);
  if (filters.limit) params.limit = String(filters.limit);
  if (filters.type) params.type = filters.type;
  if (filters.categoryId) params.categoryId = String(filters.categoryId);
  if (filters.tagId) params.tagId = String(filters.tagId);
  if (filters.startDate) params.startDate = filters.startDate;
  if (filters.endDate) params.endDate = filters.endDate;
  if (filters.search) params.search = filters.search;

  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => api.transactions.list(Object.keys(params).length ? params : undefined),
    select: (res) => res as PaginatedResponse<Transaction> & { success: boolean },
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Transaction> & { amount: number; date: string }) =>
      api.transactions.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Transação criada com sucesso!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Transaction> }) =>
      api.transactions.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Transação atualizada!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.transactions.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['transactions'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Transação excluída!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
