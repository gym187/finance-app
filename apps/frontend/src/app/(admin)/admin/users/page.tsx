'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatBRL } from '@/lib/formatters';
import { Search, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-sm font-medium">{children}</span>
);

interface AdminUser {
  id: number;
  name: string | null;
  email: string;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  subscription: {
    status: string;
    plan: { name: string; price: number } | null;
  } | null;
}

interface UsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo',
  TRIAL: 'Trial',
  PAST_DUE: 'Inadimplente',
  SUSPENDED: 'Suspenso',
  CANCELLED: 'Cancelado',
};

const STATUS_COLOR: Record<string, string> = {
  ACTIVE: 'text-green-600 bg-green-50',
  TRIAL: 'text-blue-600 bg-blue-50',
  PAST_DUE: 'text-yellow-600 bg-yellow-50',
  SUSPENDED: 'text-red-600 bg-red-50',
  CANCELLED: 'text-gray-600 bg-gray-100',
};

const emptyForm = { name: '', email: '', password: '', planSlug: 'pro' };

export default function AdminUsersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'users', search, status, page],
    queryFn: () =>
      api.admin
        .listUsers({
          search: search || undefined,
          status: status || undefined,
          page: String(page),
          limit: '20',
        })
        .then((r) => (r as { success: boolean; data: UsersResponse }).data),
    placeholderData: (prev) => prev,
  });

  const createMutation = useMutation({
    mutationFn: (d: typeof emptyForm) => api.admin.createUser(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      setShowCreate(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    createMutation.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Usuários</h1>
        <Button size="sm" onClick={() => { setShowCreate(true); setForm(emptyForm); setError(''); }}>
          <Plus className="h-4 w-4 mr-1" /> Novo usuário
        </Button>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, email ou empresa..."
            className="pl-9"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
        >
          <option value="">Todos os status</option>
          <option value="TRIAL">Trial</option>
          <option value="ACTIVE">Ativo</option>
          <option value="PAST_DUE">Inadimplente</option>
          <option value="SUSPENDED">Suspenso</option>
          <option value="CANCELLED">Cancelado</option>
        </select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {data ? `${data.total} usuário${data.total !== 1 ? 's' : ''}` : 'Carregando...'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}
          {!isLoading && data && (
            <>
              <div className="divide-y">
                {data.users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{u.name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      {u.subscription && (
                        <>
                          <span className="text-xs text-muted-foreground hidden sm:block">
                            {u.subscription.plan?.name ?? '—'} · {formatBRL(u.subscription.plan?.price ?? 0)}/mês
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[u.subscription.status] ?? 'bg-gray-100 text-gray-600'}`}
                          >
                            {STATUS_LABEL[u.subscription.status] ?? u.subscription.status}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground hidden md:block">
                        {new Date(u.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Detalhes
                      </Link>
                    </div>
                  </div>
                ))}
              </div>

              {data.totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 border-t px-6 py-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    {page} / {data.totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    disabled={page >= data.totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Senha inicial</Label>
              <Input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label>Plano</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={form.planSlug}
                onChange={(e) => setForm((f) => ({ ...f, planSlug: e.target.value }))}
              >
                <option value="pro">Pro</option>
              </select>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
