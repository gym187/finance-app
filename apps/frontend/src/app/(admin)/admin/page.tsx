'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatBRL } from '@/lib/formatters';
import { Users, TrendingUp, AlertCircle, Ban, Clock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

interface Plan {
  id: number;
  name: string;
  slug: string;
  price: number;
  count: number;
}

interface RecentUser {
  id: number;
  name: string | null;
  email: string;
  createdAt: string;
  subscription: { status: string; plan: { name: string } | null } | null;
}

interface AuditLog {
  id: number;
  action: string;
  targetId: number;
  targetType: string;
  createdAt: string;
  admin: { name: string | null; email: string };
}

interface Metrics {
  totalUsers: number;
  activeCount: number;
  trialCount: number;
  pastDueCount: number;
  suspendedCount: number;
  cancelledCount: number;
  mrr: number;
  plans: Plan[];
  recentUsers: RecentUser[];
  auditLogs: AuditLog[];
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

export default function AdminMetricsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'metrics'],
    queryFn: () => api.admin.metrics().then((r) => (r as { success: boolean; data: Metrics }).data),
  });

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const statCards = [
    { label: 'Usuários totais', value: data.totalUsers, icon: Users, color: 'text-blue-600' },
    { label: 'Ativos', value: data.activeCount, icon: CheckCircle2, color: 'text-green-600' },
    { label: 'Trial', value: data.trialCount, icon: Clock, color: 'text-blue-500' },
    { label: 'Inadimplentes', value: data.pastDueCount, icon: AlertCircle, color: 'text-yellow-600' },
    { label: 'Suspensos', value: data.suspendedCount, icon: Ban, color: 'text-red-600' },
    { label: 'MRR', value: formatBRL(data.mrr), icon: TrendingUp, color: 'text-emerald-600', isText: true },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Métricas</h1>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {statCards.map(({ label, value, icon: Icon, color, isText }) => (
          <Card key={label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${color}`} />
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
              <p className={`text-2xl font-bold ${color}`}>{isText ? value : value.toLocaleString('pt-BR')}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Planos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição por plano</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.plans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{plan.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBRL(plan.price)}/mês</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">{plan.count} assinaturas</p>
                  <p className="text-xs text-muted-foreground">{formatBRL(plan.count * Number(plan.price))}/mês</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Audit logs */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ações recentes (admin)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.auditLogs.length === 0 && (
              <p className="text-sm text-muted-foreground">Nenhuma ação registrada.</p>
            )}
            {data.auditLogs.map((log) => (
              <div key={log.id} className="flex items-start justify-between text-sm">
                <div>
                  <span className="font-mono text-xs bg-muted px-1 py-0.5 rounded">{log.action}</span>
                  <span className="ml-2 text-muted-foreground text-xs">por {log.admin.name ?? log.admin.email}</span>
                </div>
                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                  {new Date(log.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent users */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Cadastros recentes</CardTitle>
          <Link href="/admin/users" className="text-xs text-primary hover:underline">
            Ver todos
          </Link>
        </CardHeader>
        <CardContent>
          <div className="divide-y">
            {data.recentUsers.map((u) => (
              <div key={u.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{u.name ?? '—'}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  {u.subscription && (
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[u.subscription.status] ?? 'bg-gray-100 text-gray-600'}`}
                    >
                      {STATUS_LABEL[u.subscription.status] ?? u.subscription.status}
                    </span>
                  )}
                  <Link href={`/admin/users/${u.id}`} className="text-xs text-primary hover:underline">
                    Ver
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
