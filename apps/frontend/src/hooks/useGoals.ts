'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface SavingsGoal {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: string | null;
  icon: string | null;
  isCompleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useGoals() {
  return useQuery({
    queryKey: ['goals'],
    queryFn: async () => {
      const res = await api.goals.list();
      return (res as { success: boolean; data: SavingsGoal[] }).data;
    },
  });
}

export function useGoalMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['goals'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const create = useMutation({
    mutationFn: (data: unknown) => api.goals.create(data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      api.goals.update(id, data),
    onSuccess: invalidate,
  });

  const contribute = useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: number }) =>
      api.goals.contribute(id, amount),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.goals.delete(id),
    onSuccess: invalidate,
  });

  return { create, update, contribute, remove };
}
