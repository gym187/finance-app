'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, Pencil, Trash2, Download, Search, Filter } from 'lucide-react';
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
import { formatBRL, formatDate } from '@/lib/formatters';
import { api } from '@/lib/api';
import type { Transaction } from '@finance-app/shared';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const txSchema = z.object({
  description: z.string().min(1, 'Descrição obrigatória'),
  amount: z.number({ invalid_type_error: 'Valor inválido' }).positive('Deve ser positivo'),
  type: z.enum(['INCOME', 'EXPENSE']),
  categoryId: z.number({ invalid_type_error: 'Selecione uma categoria' }),
  date: z.string().min(1, 'Data obrigatória'),
});
type TxForm = z.infer<typeof txSchema>;

export default function TransactionsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showForm, setShowForm] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);

  const filters = { page, limit: 20, search: search || undefined, type: typeFilter || undefined };
  const { data: txData, isLoading } = useTransactions(filters);
  const { data: categories = [] } = useCategories();
  const createTx = useCreateTransaction();
  const updateTx = useUpdateTransaction();
  const deleteTx = useDeleteTransaction();

  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } =
    useForm<TxForm>({
      resolver: zodResolver(txSchema),
      defaultValues: { date: new Date().toISOString().split('T')[0] },
    });

  const openCreate = () => {
    setEditTx(null);
    reset({ date: new Date().toISOString().split('T')[0], type: 'EXPENSE' });
    setShowForm(true);
  };

  const openEdit = (tx: Transaction) => {
    setEditTx(tx);
    reset({
      description: tx.description,
      amount: Math.abs(tx.amount),
      type: tx.type,
      categoryId: tx.categoryId,
      date: new Date(tx.date).toISOString().split('T')[0],
    });
    setShowForm(true);
  };

  const onSubmit = async (data: TxForm) => {
    if (editTx) {
      await updateTx.mutateAsync({ id: editTx.id, data });
    } else {
      await createTx.mutateAsync(data);
    }
    setShowForm(false);
    reset();
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
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar transações..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="INCOME">Entradas</SelectItem>
            <SelectItem value="EXPENSE">Saídas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="hidden md:table-cell">Categoria</TableHead>
              <TableHead className="hidden sm:table-cell">Tipo</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-16 sm:w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j} className={j === 2 ? 'hidden md:table-cell' : j === 3 ? 'hidden sm:table-cell' : ''}><Skeleton className="h-4 w-full" /></TableCell>
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
              txData?.data?.map((tx) => {
                const typedTx = tx as unknown as Transaction;
                return (
                  <TableRow key={typedTx.id}>
                    <TableCell className="text-muted-foreground text-xs sm:text-sm">
                      {formatDate(typedTx.date)}
                    </TableCell>
                    <TableCell className="font-medium">{typedTx.description}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-2">
                        {typedTx.category?.color && (
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: typedTx.category.color }}
                          />
                        )}
                        <span className="text-sm">{typedTx.category?.name ?? '—'}</span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant={typedTx.type === 'INCOME' ? 'income' : 'expense'}>
                        {typedTx.type === 'INCOME' ? 'Entrada' : 'Saída'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <span className={typedTx.type === 'INCOME' ? 'text-green-600' : 'text-red-600'}>
                        {typedTx.type === 'INCOME' ? '+' : '-'}
                        {formatBRL(Math.abs(typedTx.amount))}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(typedTx)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost" size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteTx.mutate(typedTx.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {page} de {totalPages}
          </span>
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
                <label className="mb-1.5 block text-sm font-medium">Valor (R$)</label>
                <Input
                  type="number" step="0.01" min="0"
                  {...register('amount', { valueAsNumber: true })}
                  placeholder="0,00"
                />
                {errors.amount && <p className="mt-1 text-xs text-destructive">{errors.amount.message}</p>}
              </div>
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
            </div>
            <div className="grid grid-cols-2 gap-3">
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
                <label className="mb-1.5 block text-sm font-medium">Data</label>
                <Input type="date" {...register('date')} />
                {errors.date && <p className="mt-1 text-xs text-destructive">{errors.date.message}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setShowForm(false)}>Cancelar</Button>
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
