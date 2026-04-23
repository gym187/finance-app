'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface ProjectionPoint {
  month: string;
  label: string;
  optimistic: number;
  conservative: number;
}

export interface ProjectionData {
  currentBalance: number;
  recurringMonthlyNet: number;
  historicalAvgMonthly: number;
  projection: ProjectionPoint[];
}

export function useProjection() {
  return useQuery({
    queryKey: ['projection'],
    queryFn: async () => {
      const res = await api.dashboard.projection();
      return (res as { success: boolean; data: ProjectionData }).data;
    },
    staleTime: 10 * 60 * 1000,
  });
}
