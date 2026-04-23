import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function useExchangeRates() {
  return useQuery({
    queryKey: ['exchange-rates'],
    queryFn: () => api.exchange.rates(),
    select: (res) => res.data,
    staleTime: 60 * 60 * 1000, // 1h — same as backend cache
  });
}
