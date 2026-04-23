'use client';

import { useState } from 'react';
import {
  Plus, Pencil, Trash2, RefreshCw,
  RepeatIcon, CheckCircle2, PauseCircle,
  ArrowUpRight, ArrowDownRight, CalendarClock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecurring, useRecurringMutations, FREQ_LABELS } from '@/hooks/useRecurring';
import { useCategories } from '@/hooks/useCategories';
import { formatBRL, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { RecurringTransaction, RecurrencyFreq } from '@/hooks/useRecurring';
import type { Category } from '@finance-app/shared';

// ─── Modal ──────────────────────────────────────────────────────────────────

interface FormState {
  description: string;
  amount: string;
  type: 'INCOME' | 'EXPENSE';
  categoryId: string;
  frequency: RecurrencyFreq;
  startDate: string;
  endDate: string;
}

const today = new Date().toISOString().split('T')[0];

const emptyForm: FormState = {
  description: '',
  amount: '',
  type: 'EXPENSE',
  categoryId: '',
  frequency: 'MONTHLY',
  startDate: today,
  endDate: '',
};

function RecurringModal({
  open, onClose, onSubmit, editing, categories, isLoading,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: unknown) => Promise<void>;
  editing?: RecurringTransaction | null;
  categories: Category[];
  isLoading?: boolean;
}) {
  const [form, setForm] = useState<FormState>(emptyForm);

  useState(() => {
    if (editing) {
      setForm({
        description: editing.description,
        amount: String(Math.abs(Number(editing.amount))),
        type: editing.type,
        categoryId: String(editing.categoryId),
        frequency: editing.frequency,
        startDate: editing.startDate.split('T')[0],
        endDate: editing.endDate ? editing.endDate.split('T')[0] : '',
      });
    } else {
      setForm(emptyForm);
    }
  });

  const f = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((s) => ({ ...s, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      description: form.description.trim(),
      amount: parseFloat(form.amount),
      type: form.type,
      categoryId: parseInt(form.categoryId, 10),
      frequency: form.frequency,
      startDate: form.startDate,
    };
    if (form.endDate) payload.endDate = form.endDate;
    await onSubmit(payload);
  };

  const filteredCats = categories.filter((c) =>
    form.type === 'INCOME'
      ? ['Salário', 'Renda Extra', 'Freelance', 'Investimentos'].some((k) =>
          c.name.toLowerCase().includes(k.toLowerCase())
        ) || true
      : true
  );

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RepeatIcon className="h-4 w-4 text-primary" />
            {editing ? 'Editar Recorrência' : 'Nova Recorrência'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            {/* Description */}
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Descrição *
              </label>
              <Input placeholder="Ex: Aluguel, Netflix, Salário..." {...f('description')} required />
            </div>

            {/* Type */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Tipo *
              </label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((s) => ({ ...s, type: v as 'INCOME' | 'EXPENSE' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EXPENSE">Despesa</SelectItem>
                  <SelectItem value="INCOME">Receita</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Amount */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Valor (R$) *
              </label>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                {...f('amount')}
                required
              />
            </div>

            {/* Category */}
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Categoria *
              </label>
              <Select
                value={form.categoryId}
                onValueChange={(v) => setForm((s) => ({ ...s, categoryId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredCats.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: c.color ?? '#6b7280' }}
                        />
                        {c.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Frequency */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Frequência *
              </label>
              <Select
                value={form.frequency}
                onValueChange={(v) => setForm((s) => ({ ...s, frequency: v as RecurrencyFreq }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(FREQ_LABELS) as [RecurrencyFreq, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Start date */}
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Início *
              </label>
              <Input type="date" {...f('startDate')} required />
            </div>

            {/* End date */}
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Término (opcional — deixe vazio para repetir indefinidamente)
              </label>
              <Input type="date" {...f('endDate')} min={form.startDate} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Badge de frequência ──────────────────────────────────────────────────────

const FREQ_COLORS: Record<RecurrencyFreq, string> = {
  DAILY:    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  WEEKLY:   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  BIWEEKLY: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  MONTHLY:  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

// ─── Page ────────────────────────────────────────────────────────────────────

export default function RecurringPage() {
  const { data: items = [], isLoading, refetch } = useRecurring();
  const { data: categories = [] } = useCategories();
  const { create, update, remove, toggle } = useRecurringMutations();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringTransaction | null>(null);

  const activeItems = items.filter((i) => i.isActive);
  const inactiveItems = items.filter((i) => !i.isActive);
  const monthlyTotal = activeItems.reduce((sum, i) => {
    const amt = Math.abs(Number(i.amount));
    const multiplier =
      i.frequency === 'DAILY' ? 30
      : i.frequency === 'WEEKLY' ? 4.33
      : i.frequency === 'BIWEEKLY' ? 2.17
      : 1;
    return i.type === 'EXPENSE' ? sum - amt * multiplier : sum + amt * multiplier;
  }, 0);

  const monthlyExpense = activeItems
    .filter((i) => i.type === 'EXPENSE')
    .reduce((sum, i) => {
      const amt = Math.abs(Number(i.amount));
      const m = i.frequency === 'DAILY' ? 30 : i.frequency === 'WEEKLY' ? 4.33 : i.frequency === 'BIWEEKLY' ? 2.17 : 1;
      return sum + amt * m;
    }, 0);

  const monthlyIncome = activeItems
    .filter((i) => i.type === 'INCOME')
    .reduce((sum, i) => {
      const amt = Math.abs(Number(i.amount));
      const m = i.frequency === 'DAILY' ? 30 : i.frequency === 'WEEKLY' ? 4.33 : i.frequency === 'BIWEEKLY' ? 2.17 : 1;
      return sum + amt * m;
    }, 0);

  const handleOpenNew = () => { setEditing(null); setModalOpen(true); };
  const handleEdit = (item: RecurringTransaction) => { setEditing(item); setModalOpen(true); };
  const handleDelete = async (id: number) => {
    if (!confirm('Excluir esta recorrência?')) return;
    await remove.mutateAsync(id);
  };
  const handleToggle = async (item: RecurringTransaction) => {
    await toggle.mutateAsync({ id: item.id, isActive: !item.isActive });
  };
  const handleSubmit = async (data: unknown) => {
    if (editing) await update.mutateAsync({ id: editing.id, data });
    else await create.mutateAsync(data);
    setModalOpen(false);
  };

  const isMutating = create.isPending || update.isPending;

  const renderItem = (item: RecurringTransaction) => (
    <div
      key={item.id}
      className={cn(
        'flex items-center gap-3 rounded-xl border p-4 transition-colors',
        !item.isActive && 'opacity-50'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full',
          item.type === 'INCOME'
            ? 'bg-green-100 dark:bg-green-900/30'
            : 'bg-red-100 dark:bg-red-900/30'
        )}
      >
        {item.type === 'INCOME' ? (
          <ArrowUpRight className="h-5 w-5 text-green-600" />
        ) : (
          <ArrowDownRight className="h-5 w-5 text-red-500" />
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{item.description}</span>
          <span
            className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', FREQ_COLORS[item.frequency])}
          >
            {FREQ_LABELS[item.frequency]}
          </span>
          {!item.isActive && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
              Pausado
            </span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span
            className="inline-flex items-center gap-1"
            style={{ color: item.category.color ?? undefined }}
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.category.color ?? '#6b7280' }}
            />
            {item.category.name}
          </span>
          <span className="flex items-center gap-1">
            <CalendarClock className="h-3 w-3" />
            Próximo: {formatDate(item.nextDueDate)}
          </span>
          {item.endDate && <span>Até {formatDate(item.endDate)}</span>}
        </div>
      </div>

      {/* Amount */}
      <span
        className={cn(
          'flex-shrink-0 text-base font-bold',
          item.type === 'INCOME' ? 'text-green-600' : 'text-red-500'
        )}
      >
        {item.type === 'INCOME' ? '+' : '-'}{formatBRL(Math.abs(Number(item.amount)))}
      </span>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={item.isActive ? 'Pausar' : 'Reativar'}
          onClick={() => handleToggle(item)}
        >
          {item.isActive
            ? <PauseCircle className="h-4 w-4 text-muted-foreground" />
            : <CheckCircle2 className="h-4 w-4 text-green-500" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => handleEdit(item)}
        >
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          onClick={() => handleDelete(item.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Contas Recorrentes</h2>
          <p className="text-sm text-muted-foreground">
            Receitas e despesas fixas geradas automaticamente
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" />
            Nova Recorrência
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        {[
          {
            label: 'Receitas Fixas / mês',
            value: formatBRL(monthlyIncome),
            color: 'text-green-600',
            bg: 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800',
          },
          {
            label: 'Despesas Fixas / mês',
            value: formatBRL(monthlyExpense),
            color: 'text-red-500',
            bg: 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800',
          },
          {
            label: 'Saldo Recorrente / mês',
            value: formatBRL(monthlyTotal),
            color: monthlyTotal >= 0 ? 'text-blue-600' : 'text-red-500',
            bg: 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800',
          },
        ].map((s) => (
          <Card key={s.label} className={cn('border', s.bg)}>
            <CardContent className="p-4">
              <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
              {isLoading ? (
                <Skeleton className="mt-1 h-7 w-32" />
              ) : (
                <p className={cn('mt-1 text-2xl font-bold', s.color)}>{s.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Ativas
            {activeItems.length > 0 && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                {activeItems.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))
          ) : activeItems.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-center">
              <RepeatIcon className="h-10 w-10 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhuma recorrência ativa</p>
              <Button size="sm" variant="outline" onClick={handleOpenNew}>
                <Plus className="mr-1 h-4 w-4" /> Criar primeira
              </Button>
            </div>
          ) : (
            activeItems.map(renderItem)
          )}
        </CardContent>
      </Card>

      {/* Inactive list */}
      {inactiveItems.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-muted-foreground">
              <PauseCircle className="h-4 w-4" />
              Pausadas ({inactiveItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inactiveItems.map(renderItem)}
          </CardContent>
        </Card>
      )}

      <RecurringModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        editing={editing}
        categories={categories}
        isLoading={isMutating}
      />
    </div>
  );
}
