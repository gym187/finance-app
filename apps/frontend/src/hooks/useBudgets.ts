import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { Budget } from '@finance-app/shared';

export function useBudgets() {
  return useQuery({
    queryKey: ['budgets'],
    queryFn: () => api.budgets.list(),
    select: (res) => (res.data as Budget[]) ?? [],
  });
}

export function useCreateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<Budget>) => api.budgets.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Orçamento criado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<Budget> }) =>
      api.budgets.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Orçamento atualizado!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteBudget() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.budgets.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success('Orçamento excluído!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
