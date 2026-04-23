'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Loan {
  id: number;
  name: string;
  principalAmount: number;
  currentBalance: number;
  interestRate: number;
  startDate: string;
  dueDayOfMonth: number;
  installments: number | null;
  installmentAmount: number | null;
  totalPaid: number;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
}

export interface LoanPayment {
  id: number;
  loanId: number;
  date: string;
  type: 'FULL' | 'INTEREST_ONLY';
  amount: number;
  interestAmount: number;
  principalAmount: number;
  balanceBefore: number;
  balanceAfter: number;
}

export interface LoanScheduleRow {
  period: number;
  date: string;
  installment: number;
  interest: number;
  principal: number;
  balance: number;
}

export interface LoanSummary {
  totalDebt: number;
  totalPaid: number;
  activeCount: number;
  nextDue: {
    id: number;
    name: string;
    dueDate: string;
    installmentAmount: number | null;
    currentBalance: number;
    interestRate: number;
  }[];
}

export function useLoans() {
  return useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      const res = await api.loans.list();
      return (res as { success: boolean; data: Loan[] }).data;
    },
  });
}

export function useLoanSummary() {
  return useQuery({
    queryKey: ['loans', 'summary'],
    queryFn: async () => {
      const res = await api.loans.summary();
      return (res as { success: boolean; data: LoanSummary }).data;
    },
  });
}

export function useLoanPayments(id: number) {
  return useQuery({
    queryKey: ['loans', id, 'payments'],
    queryFn: async () => {
      const res = await api.loans.payments(id);
      return (res as { success: boolean; data: LoanPayment[] }).data;
    },
    enabled: id > 0,
  });
}

export function useLoanSchedule(id: number, enabled: boolean) {
  return useQuery({
    queryKey: ['loans', id, 'schedule'],
    queryFn: async () => {
      const res = await api.loans.schedule(id);
      return (res as { success: boolean; data: LoanScheduleRow[] }).data;
    },
    enabled: enabled && id > 0,
  });
}

export function useLoanMutations() {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['loans'] });
    qc.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const create = useMutation({
    mutationFn: (data: unknown) => api.loans.create(data),
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => api.loans.update(id, data),
    onSuccess: invalidate,
  });

  const pay = useMutation({
    mutationFn: ({ id, type }: { id: number; type: 'FULL' | 'INTEREST_ONLY' }) =>
      api.loans.pay(id, type),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      qc.invalidateQueries({ queryKey: ['loans', id, 'payments'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.loans.delete(id),
    onSuccess: invalidate,
  });

  return { create, update, pay, remove };
}
