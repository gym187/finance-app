import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DashboardData } from '@finance-app/shared';

export function useDashboard() {
  return useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.dashboard.get(),
    select: (res) => (res as { success: boolean; data: DashboardData }).data,
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
  });
}
