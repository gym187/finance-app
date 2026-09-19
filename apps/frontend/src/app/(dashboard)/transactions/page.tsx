'use client';

import { useState } from 'react';
import { Plus, Trash2, Download, Search, Filter, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  useTransactions, useCreateTransaction, useUpdateTransaction, useDeleteTransaction,
} from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useTags } from '@/hooks/useTags';
import { useExchangeRates } from '@/hooks/useExchangeRates';
import { TagSelector } from '@/components/transactions/TagSelector';
import { formatBRL, formatDate, todayBR } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { ImportModal } from '@/components/transactions/ImportModal';
import type { Transaction, Currency } from '@finance-app/shared';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const CURRENCIES = ['BRL', 'USD', 'EUR', 'GBP', 'BTC'] as const;

const CURRENCY_LABELS: Record<string, string> = {
  BRL: 'BRL — Real',
  USD: 'USD — Dólar',
  EUR: 'EUR — Euro',
  GBP: 'GBP — Libra',
  BTC: 'BTC — Bitcoin',
};

const txSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória'),
  amount: z.number({ invalid_type_error: 'Valor inválido' }).positive('Deve ser positivo'),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.number({ invalid_type_error: 'Selecione uma categoria' }),
  date: z.string().min(1, 'Data obrigatória'),
  currency: z.enum(['BRL', 'USD', 'EUR', 'GBP', 'BTC']).default('BRL'),
});
type TxForm = z.infer<typeof txSchema>;

interface TagData { id: number; name: string; color: string }
type TxWithTags = Transaction & { tags?: TagData[] };

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [tagFilter, setTagFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [editTx, setEditTx] = useState<TxWithTags | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);

  const filters = {
    page,
    limit: 20,
    search: search || undefined,
    type: typeFilter || undefined,
    tagId: tagFilter || undefined,
  };
  const { data: txData, isLoading } = useTransactions(filters);
  const { data: categories = [] } = useCategories();
  const { data: tags = [] } = useTags();
  const { data: ratesData } = useExchangeRates();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<TxForm>({
      resolver: zodResolver(txSchema),
      defaultValues: { date: todayBR() },
    });

  const openCreate = () => {
    setEditTx(null);
    setSelectedTagIds([]);
    reset({ date: todayBR(), type: 'EXPENSE', currency: 'BRL' });
    setShowForm(true);
  };

  const openEdit = (tx: TxWithTags) => {
    setEditTx(tx);
    setSelectedTagIds(tx.tags?.map((t) => t.id) ?? []);
    reset({
      description: tx.description,
      amount: tx.amountOriginal != null ? Math.abs(tx.amountOriginal) : Math.abs(tx.amount),
      type: tx.type,
      categoryId: tx.categoryId,
      date: new Date(tx.date).toISOString().split('T')[0],
      currency: (tx.currency as Currency) ?? 'BRL',
    });
    setShowForm(true);
  };

  const onSubmit = async (data: TxForm) => {
    const payload = { ...data, tagIds: selectedTagIds };
    if (editTx) {
      await updateTx.mutateAsync({ id: editTx.id, data: payload });
    } else {
      await createTx.mutateAsync(payload);
    }
    setShowForm(false);
    reset();
    setSelectedTagIds([]);
  };

  const handleExport = async () => {
    const res = await api.transactions.exportCSV();
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'transacoes.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = txData?.totalPages ?? 1;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Transações</h2>
          <p className="text-sm text-muted-foreground">
            {txData?.total ?? 0} registros encontrados
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} className="hidden sm:inline-flex">
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="icon" onClick={handleExport} className="sm:hidden">
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowImport(true)} className="hidden sm:inline-flex">
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button onClick={openCreate} size="sm" className="hidden sm:inline-flex">
            <Plus className="mr-2 h-4 w-4" />
            Nova Transação
          </Button>
          <Button onClick={openCreate} size="icon" className="sm:hidden">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar transações..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="h-4 w-4 text-muted-foreground" />
          {[
            { label: 'Todas', value: '' },
            { label: 'Receitas', value: 'INCOME' },
            { label: 'Despesas', value: 'EXPENSE' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => { setTypeFilter(tab.value); setPage(1); }}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                typeFilter === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Data</TableHead>
              <TableHead className="hidden sm:table-cell text-xs uppercase tracking-wide">Tipo</TableHead>
              <TableHead className="hidden md:table-cell text-xs uppercase tracking-wide">Categoria</TableHead>
              <TableHead className="text-xs uppercase tracking-wide">Descrição</TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wide">Valor</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j} className={j === 1 ? 'hidden sm:table-cell' : j === 2 ? 'hidden md:table-cell' : ''}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : txData?.data?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  Nenhuma transação encontrada
                </TableCell>
              </TableRow>
            ) : (
              (txData?.data as unknown as TxWithTags[])?.map((tx) => (
                <TableRow
                  key={tx.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => openEdit(tx)}
                >
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(tx.date)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <span className={cn(
                      'inline-flex rounded-md border px-2 py-0.5 text-xs font-medium',
                      tx.type === 'INCOME'
                        ? 'border-income/50 text-income'
                        : 'border-expense/50 text-expense'
                    )}>
                      {tx.type === 'INCOME' ? 'Receita' : 'Despesa'}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-2">
                      {tx.category?.color && (
                        <span className="h-4 w-0.5 flex-shrink-0 rounded-full" style={{ background: tx.category.color }} />
                      )}
                      <span className="text-sm">{tx.category?.name ?? '—'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{tx.description || '—'}</TableCell>
                  <TableCell className="text-right font-semibold tracking-tight font-[family-name:var(--font-roboto-mono)]">
                    <div className="flex flex-col items-end">
                      <span className={tx.type === 'INCOME' ? 'text-income' : 'text-expense'}>
                        {tx.type === 'INCOME' ? '+' : '-'}{formatBRL(Math.abs(tx.amount))}
                      </span>
                      {tx.currency !== 'BRL' && tx.amountOriginal != null && (
                        <span className="text-xs text-muted-foreground">
                          {tx.currency} {Math.abs(tx.amountOriginal).toLocaleString('pt-BR', {
                            minimumFractionDigits: tx.currency === 'BTC' ? 8 : 2,
                            maximumFractionDigits: tx.currency === 'BTC' ? 8 : 2,
                          })}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      variant="ghost" size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => confirm('Excluir esta transação?') && deleteTx.mutate(tx.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Página {page} de {totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Próxima
            </Button>
          </div>
        </div>
      )}

      <ImportModal open={showImport} onClose={() => setShowImport(false)} />

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editTx ? 'Editar Transação' : 'Nova Transação'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium">Descrição</label>
              <Input {...register('description')} placeholder="Ex: Almoço no restaurante" />
              {errors.description && <p className="mt-1 text-xs text-destructive">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">
                  Valor ({watch('currency') ?? 'BRL'})
                </label>
                <Input
                  type="number"
                  step={watch('currency') === 'BTC' ? '0.00000001' : '0.01'}
                  min="0"
                  {...register('amount', { valueAsNumber: true })}
                  placeholder="0,00"
                />
                {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount.message}</p>}
                {watch('currency') !== 'BRL' && watch('amount') > 0 && ratesData?.rates[watch('currency')] && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ≈ {formatBRL(watch('amount') * (ratesData.rates[watch('currency')] ?? 1))}
                  </p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Moeda</label>
                <Select
                  value={watch('currency') ?? 'BRL'}
                  onValueChange={(v) => setValue('currency', v as Currency)}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>{CURRENCY_LABELS[c]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium">Tipo</label>
                <Select
                  value={watch('type')}
                  onValueChange={(v) => setValue('type', v as 'INCOME' | 'EXPENSE')}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EXPENSE">Saída</SelectItem>
                    <SelectItem value="INCOME">Entrada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium">Data</label>
                <Input type="date" {...register('date')} />
                {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date.message}</p>}
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Categoria</label>
              <Select
                value={watch('categoryId')?.toString()}
                onValueChange={(v) => setValue('categoryId', parseInt(v))}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categoryId && <p className="mt-1 text-xs text-destructive">{errors.categoryId.message}</p>}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium">Tags</label>
              <TagSelector selectedIds={selectedTagIds} onChange={setSelectedTagIds} />
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => { setShowForm(false); setSelectedTagIds([]); }}>
                Cancelar
              </Button>
              <Button type="submit" disabled={createTx.isPending || updateTx.isPending}>
                {editTx ? 'Salvar' : 'Criar'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
