import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';

export interface Tag {
  id: number;
  name: string;
  color: string;
}

export function useTags() {
  return useQuery({
    queryKey: ['tags'],
    queryFn: () => api.tags.list(),
    select: (res) => (res.data ?? []) as Tag[],
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; color?: string }) => api.tags.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag criada!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name?: string; color?: string } }) =>
      api.tags.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      toast.success('Tag atualizada!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.tags.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      qc.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Tag excluída!');
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
