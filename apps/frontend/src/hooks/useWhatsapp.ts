import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface WhatsappStatus {
  linked: boolean;
  phone: string | null;
}

export interface LinkCode {
  code: string;
  expiresAt: string;
  botNumber: string | null;
}

export function useWhatsappStatus(options?: { poll?: boolean }) {
  return useQuery({
    queryKey: ['whatsapp', 'status'],
    queryFn: async () => (await api.whatsapp.status()).data as WhatsappStatus,
    refetchInterval: options?.poll ? 8000 : false,
  });
}

export function useCreateLinkCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => (await api.whatsapp.createLinkCode()).data as LinkCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp'] }),
  });
}

export function useUnlinkWhatsapp() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.whatsapp.unlink(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp'] }),
  });
}
