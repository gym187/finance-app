'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useBudgets, useCreateBudget, useUpdateBudget, useDeleteBudget } from '@/hooks/useBudgets';
import { useCategories } from '@/hooks/useCategories';
import { useDashboard } from '@/hooks/useDashboard';
import { formatBRL, formatPercent, currentMonth, monthLabel } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Budget } from '@finance-app/shared';

const budgetSchema = z.object({
  categoryId: z.number().optional().nullable(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.number({ invalid_type_error: 'Valor inválido' }).positive(),
  type: z.enum(['INCOME', 'EXPENSE', 'TOTAL']),
});
type BudgetForm = z.infer<typeof budgetSchema>;

export default function BudgetsPage() {
  const [month, setMonth] = useState(currentMonth());
  const [showForm, setShowForm] = useState(false);
  const [editBudget, setEditBudget] = useState<Budget | null>(null);

  const { data: budgets = [], isLoading } = useBudgets(month);
  const { data: categories = [] } = useCategories();
  const { data: dashboard } = useDashboard();
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const deleteBudget = useDeleteBudget();

  const summaryMap = new Map(
    (dashboard?.budgetSummary ?? []).map((s) => [s.id, s])
  );

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<BudgetForm>({ resolver: zodResolver(budgetSchema), defaultValues: { month: currentMonth(), type: 'EXPENSE' } });

  const openCreate = () => {
    setEditBudget(null);
    reset({ month, type: 'EXPENSE' });
    setShowForm(true);
  };

  const openEdit = (b: Budget) => {
    setEditBudget(b);
    reset({ categoryId: b.categoryId, month: b.month, amount: b.amount, type: b.type });
    setShowForm(true);
  };

  const onSubmit = async (data: BudgetForm) => {
    if (editBudget) {
      await updateBudget.mutateAsync({ id: editBudget.id, data });
    } else {
      await createBudget.mutateAsync(data);
    }
    setShowForm(false);
    reset();
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Orçamentos</h2>
          <p className="text-sm text-muted-foreground">{monthLabel(month)}</p>
        </div>
        <div className="flex gap-2 sm:gap-3">
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-36 sm:w-40"
          />
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Orçamento
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}><CardContent className="p-6"><Skeleton className="h-24 w-full" /></CardContent></Card>
            ))
          : budgets.length === 0
          ? (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              Nenhum orçamento para {monthLabel(month)}.{' '}
              <button onClick={openCreate} className="text-primary hover:underline">
                Criar agora
              </button>
            </div>
          )
          : budgets.map((b) => {
              const summary = summaryMap.get(b.id);
              const pct = summary?.percentage ?? 0;
              const spent = summary?.spent ?? 0;
              const color =
                pct >= 100 ? 'bg-red-500' : pct >= 80 ? 'bg-amber-500' : 'bg-primary';
              const catName = b.category?.name ?? 'Orçamento Total';

              return (
                <Card key={b.id} className="group">
                  <CardContent className="p-5 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          {b.category?.color && (
                            <span
                              className="h-3 w-3 rounded-full"
                              style={{ background: b.category.color }}
                            />
                          )}
                          <p className="font-semibold">{catName}</p>
                        </div>
                        <Badge
                          variant={b.type === 'INCOME' ? 'income' : 'expense'}
                          className="mt-1"
                        >
                          {b.type === 'INCOME' ? 'Entrada' : b.type === 'EXPENSE' ? 'Saída' : 'Total'}
                        </Badge>
                      </div>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 transition-opacity group-hover:opacity-100">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(b)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => deleteBudget.mutate(b.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <Progress value={Math.min(pct, 100)} className="h-2" indicatorClassName={color} />

                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {formatBRL(spent)} gasto
                      </span>
                      <span className={cn('font-semibold', pct >= 100 ? 'text-red-500' : pct >= 80 ? 'text-amber-500' : '')}>
                        {formatPercent(pct)} / {formatBRL(Number(b.amount))}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editBudget ? 'Editar Orçamento' : 'Novo Orçamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Categoria (opcional)</label>
              <Select
                value={watch('categoryId')?.toString() ?? 'none'}
                onValueChange={(v) => setValue('categoryId', v === 'none' ? null : parseInt(v))}
              >
                <SelectTrigger><SelectValue placeholder="Total geral" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Total geral</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Mês</label>
                <Input type="month" {...register('month')} />
                {errors.month && <p className="mt-1 text-xs text-destructive">{errors.month.message}</p>}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tipo</label>
                <Select
                  value={watch('type')}
                  onValueChange={(v) => setValue('type', v as 'INCOME' | 'EXPENSE' | 'TOTAL')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Saída</SelectItem>
                    <SelectItem value="INCOME">Entrada</SelectItem>
                    <SelectItem value="TOTAL">Total</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Valor Limite (R$)</label>
              <Input
                type="number" step="0.01" min="0"
                {...register('amount', { valueAsNumber: true })}
                placeholder="0,00"
              />
              {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
              <Button type="submit" disabled={createBudget.isPending || updateBudget.isPending}>
                {editBudget ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
