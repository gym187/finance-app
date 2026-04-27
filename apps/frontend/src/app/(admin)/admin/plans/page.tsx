'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatBRL } from '@/lib/formatters';
import { Plus, Save } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-sm font-medium">{children}</span>
);

interface Plan {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  trialDays: number;
}

const emptyForm = { name: '', slug: '', description: '', price: '', trialDays: '14' };

export default function AdminPlansPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [msg, setMsg] = useState('');

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api.admin.listPlans().then((r) => (r as { success: boolean; data: Plan[] }).data),
  });

  const upsertMutation = useMutation({
    mutationFn: (d: typeof form) =>
      api.admin.upsertPlan({
        name: d.name,
        slug: d.slug,
        description: d.description || undefined,
        price: parseFloat(d.price),
        trialDays: parseInt(d.trialDays, 10),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      setForm(emptyForm);
      setEditing(null);
      setMsg('Plano salvo com sucesso.');
      setTimeout(() => setMsg(''), 3000);
    },
    onError: (e: Error) => setMsg(e.message),
  });

  function startEdit(plan: Plan) {
    setEditing(plan);
    setForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description ?? '',
      price: String(plan.price),
      trialDays: String(plan.trialDays),
    });
    setMsg('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    upsertMutation.mutate(form);
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Planos</h1>

      {/* Plan list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Planos cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading && (
            <div className="flex h-24 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}
          {!isLoading && plans && (
            <div className="divide-y">
              {plans.map((plan) => (
                <div key={plan.id} className="flex items-center justify-between px-6 py-4">
                  <div>
                    <p className="font-medium">{plan.name}</p>
                    <p className="text-xs text-muted-foreground">
                      slug: {plan.slug} · trial: {plan.trialDays} dias
                    </p>
                    {plan.description && <p className="text-sm text-muted-foreground mt-0.5">{plan.description}</p>}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="font-bold text-lg">{formatBRL(Number(plan.price))}<span className="text-xs font-normal text-muted-foreground">/mês</span></p>
                    <Button variant="outline" size="sm" onClick={() => startEdit(plan)}>
                      Editar
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            {editing ? `Editando: ${editing.name}` : (
              <>
                <Plus className="h-4 w-4" /> Novo plano
              </>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                  required
                  placeholder="ex: pro, basic"
                  disabled={!!editing}
                />
              </div>
              <div className="space-y-2">
                <Label>Preço (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Dias de trial</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.trialDays}
                  onChange={(e) => setForm((f) => ({ ...f, trialDays: e.target.value }))}
                  required
                />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={upsertMutation.isPending}>
                <Save className="h-4 w-4 mr-1" />
                {upsertMutation.isPending ? 'Salvando...' : editing ? 'Atualizar plano' : 'Criar plano'}
              </Button>
              {editing && (
                <Button type="button" variant="outline" size="sm" onClick={() => { setEditing(null); setForm(emptyForm); setMsg(''); }}>
                  Cancelar
                </Button>
              )}
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
