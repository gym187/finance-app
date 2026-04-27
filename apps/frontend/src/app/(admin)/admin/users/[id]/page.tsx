'use client';

import { use, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatBRL } from '@/lib/formatters';
import { ChevronLeft, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-sm font-medium">{children}</span>
);
import Link from 'next/link';

interface AdminUserDetail {
  id: number;
  name: string | null;
  email: string;
  phone: string | null;
  document: string | null;
  companyName: string | null;
  role: string;
  emailVerified: boolean;
  createdAt: string;
  subscription: {
    id: number;
    status: string;
    startDate: string | null;
    endDate: string | null;
    trialEnd: string | null;
    notes: string | null;
    plan: { id: number; name: string; slug: string; price: number };
  } | null;
}

const STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED'] as const;
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Ativo', TRIAL: 'Trial', PAST_DUE: 'Inadimplente', SUSPENDED: 'Suspenso', CANCELLED: 'Cancelado',
};

export default function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const userId = parseInt(id, 10);
  const qc = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: ['admin', 'users', userId],
    queryFn: () => api.admin.getUser(userId).then((r) => (r as { success: boolean; data: AdminUserDetail }).data),
  });

  const [userForm, setUserForm] = useState({ name: '', phone: '', document: '', companyName: '', role: 'USER' });
  const [subForm, setSubForm] = useState({ status: 'ACTIVE', endDate: '', planSlug: 'pro', notes: '' });
  const [userMsg, setUserMsg] = useState('');
  const [subMsg, setSubMsg] = useState('');

  // Populate forms when data loads
  if (user && userForm.name === '' && user.name) {
    setUserForm({
      name: user.name ?? '',
      phone: user.phone ?? '',
      document: user.document ?? '',
      companyName: user.companyName ?? '',
      role: user.role,
    });
  }
  if (user?.subscription && subForm.status === 'ACTIVE' && !subMsg) {
    setSubForm({
      status: user.subscription.status,
      endDate: user.subscription.endDate ? user.subscription.endDate.split('T')[0] : '',
      planSlug: user.subscription.plan?.slug ?? 'pro',
      notes: user.subscription.notes ?? '',
    });
  }

  const updateUserMutation = useMutation({
    mutationFn: (d: typeof userForm) => api.admin.updateUser(userId, d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users', userId] });
      setUserMsg('Salvo com sucesso.');
      setTimeout(() => setUserMsg(''), 3000);
    },
    onError: (e: Error) => setUserMsg(e.message),
  });

  const updateSubMutation = useMutation({
    mutationFn: (d: typeof subForm) =>
      api.admin.updateSubscription(userId, {
        status: d.status,
        endDate: d.endDate || null,
        planSlug: d.planSlug,
        notes: d.notes,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users', userId] });
      setSubMsg('Assinatura atualizada.');
      setTimeout(() => setSubMsg(''), 3000);
    },
    onError: (e: Error) => setSubMsg(e.message),
  });

  if (isLoading || !user) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/users">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold">{user.name ?? user.email}</h1>
          <p className="text-sm text-muted-foreground">
            ID #{user.id} · Cadastrado em {new Date(user.createdAt).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>

      {/* User info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados do usuário</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={userForm.name} onChange={(e) => setUserForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user.email} disabled className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <Input value={userForm.phone} onChange={(e) => setUserForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Documento</Label>
              <Input value={userForm.document} onChange={(e) => setUserForm((f) => ({ ...f, document: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <Input value={userForm.companyName} onChange={(e) => setUserForm((f) => ({ ...f, companyName: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Papel (role)</Label>
              <select
                className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                value={userForm.role}
                onChange={(e) => setUserForm((f) => ({ ...f, role: e.target.value }))}
              >
                <option value="USER">USER</option>
                <option value="ADMIN">ADMIN</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              onClick={() => updateUserMutation.mutate(userForm)}
              disabled={updateUserMutation.isPending}
            >
              <Save className="h-4 w-4 mr-1" />
              {updateUserMutation.isPending ? 'Salvando...' : 'Salvar'}
            </Button>
            {userMsg && <p className="text-sm text-muted-foreground">{userMsg}</p>}
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinatura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {user.subscription ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={subForm.status}
                    onChange={(e) => setSubForm((f) => ({ ...f, status: e.target.value }))}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Plano</Label>
                  <select
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    value={subForm.planSlug}
                    onChange={(e) => setSubForm((f) => ({ ...f, planSlug: e.target.value }))}
                  >
                    <option value="pro">Pro</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Validade</Label>
                  <Input
                    type="date"
                    value={subForm.endDate}
                    onChange={(e) => setSubForm((f) => ({ ...f, endDate: e.target.value }))}
                  />
                </div>
                {user.subscription.trialEnd && (
                  <div className="space-y-2">
                    <Label>Fim do trial</Label>
                    <Input value={new Date(user.subscription.trialEnd).toLocaleDateString('pt-BR')} disabled className="opacity-60" />
                  </div>
                )}
                <div className="col-span-2 space-y-2">
                  <Label>Observações</Label>
                  <Input
                    value={subForm.notes}
                    onChange={(e) => setSubForm((f) => ({ ...f, notes: e.target.value }))}
                    placeholder="Notas internas sobre esta assinatura"
                  />
                </div>
              </div>
              <div className="pt-1 text-xs text-muted-foreground">
                Plano atual: <strong>{user.subscription.plan?.name}</strong> · {formatBRL(user.subscription.plan?.price ?? 0)}/mês
              </div>
              <div className="flex items-center gap-3">
                <Button
                  size="sm"
                  onClick={() => updateSubMutation.mutate(subForm)}
                  disabled={updateSubMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-1" />
                  {updateSubMutation.isPending ? 'Salvando...' : 'Atualizar assinatura'}
                </Button>
                {subMsg && <p className="text-sm text-muted-foreground">{subMsg}</p>}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Nenhuma assinatura encontrada.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
