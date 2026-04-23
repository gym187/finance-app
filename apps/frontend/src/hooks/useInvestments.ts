'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Investment {
  id: number;
  name: string;
  ticker: string | null;
  type: 'STOCK' | 'FII' | 'ETF' | 'CRYPTO' | 'FIXED_INCOME' | 'OTHER';
  quantity: number;
  averagePrice: number;
  currentPrice: number | null;
  targetPercent: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InvestmentHolding {
  id: number;
  name: string;
  ticker: string | null;
  type: string;
  typeLabel: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  invested: number;
  currentValue: number;
  returnAbs: number;
  returnPct: number;
  targetPercent: number | null;
  currentPercent: number;
  notes: string | null;
}

export interface AllocationEntry {
  type: string;
  label: string;
  color: string;
  value: number;
  invested: number;
  count: number;
  percent: number;
}

export interface InvestmentSummary {
  totalInvested: number;
  currentValue: number;
  totalReturn: number;
  totalReturnPct: number;
  count: number;
  allocation: AllocationEntry[];
  holdings: InvestmentHolding[];
}

export function useInvestments() {
  return useQuery({
    queryKey: ['investments'],
    queryFn: async () => {
      const res = await api.investments.list();
      return (res as { success: boolean; data: Investment[] }).data;
    },
  });
}

export function useInvestmentSummary() {
  return useQuery({
    queryKey: ['investments', 'summary'],
    queryFn: async () => {
      const res = await api.investments.summary();
      return (res as { success: boolean; data: InvestmentSummary }).data;
    },
  });
}

export function useInvestmentMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['investments'] });
  };

  const create = useMutation({
    mutationFn: (data: unknown) => api.investments.create(data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) =>
      api.investments.update(id, data),
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.investments.delete(id),
    onSuccess: invalidate,
  });

  return { create, update, remove };
}
