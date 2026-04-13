'use client';

import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { Download, FileText, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useTransactions } from '@/hooks/useTransactions';
import { useBudgets } from '@/hooks/useBudgets';
import { formatBRL } from '@/lib/formatters';
import { api } from '@/lib/api';
import { exportReportPDF } from '@/lib/exportPDF';
import type { Transaction } from '@finance-app/shared';

export default function ReportsPage() {
  const now = new Date();
  const defaultStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(defaultEnd);
  const [showPreview, setShowPreview] = useState(false);
  const [includeCategoryTotals, setIncludeCategoryTotals] = useState(true);
  const [includeBudgets, setIncludeBudgets] = useState(false);

  const { data: txData, isLoading } = useTransactions({
    startDate,
    endDate,
    limit: 500,
  });

  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { data: budgets = [] } = useBudgets(currentMonthStr);

  const transactions = (txData?.data ?? []) as unknown as Transaction[];

  // Category breakdown
  const catMap = new Map<string, { name: string; value: number; color: string }>();
  for (const tx of transactions.filter((t) => t.type === 'EXPENSE')) {
    const name = tx.category?.name ?? 'Outros';
    const color = tx.category?.color ?? '#6b7280';
    if (!catMap.has(name)) catMap.set(name, { name, value: 0, color });
    catMap.get(name)!.value += Math.abs(Number(tx.amount));
  }
  const categoryData = Array.from(catMap.values()).sort((a, b) => b.value - a.value);

  // Summary
  const totalIncome = transactions
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
  const result = totalIncome - totalExpense;

  const fmtDatePT = (d: string) =>
    new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  const handleExportCSV = async () => {
    const res = await api.transactions.exportCSV({ startDate, endDate });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${startDate}-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const budgetSummary = budgets.map((b) => {
    let spent = 0;
    if (b.categoryId !== null) {
      spent = transactions
        .filter((t) => t.type === 'EXPENSE' && t.categoryId === b.categoryId)
        .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);
    } else {
      spent = totalExpense;
    }
    const budgeted = Number(b.amount);
    return {
      id: b.id,
      categoryId: b.categoryId,
      categoryName: b.category?.name ?? 'Orçamento Total',
      budgeted,
      spent,
      percentage: budgeted > 0 ? (spent / budgeted) * 100 : 0,
      type: b.type,
    };
  });

  const handleExportPDF = () => {
    exportReportPDF({
      transactions,
      startDate,
      endDate,
      totalIncome,
      totalExpense,
      includeCategoryTotals,
      categoryData,
      includeBudgets,
      budgetSummary,
    });
    setShowPreview(false);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold sm:text-2xl">Relatórios</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Exportar </span>CSV
          </Button>
          <Button size="sm" onClick={() => setShowPreview(true)}>
            <FileText className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Exportar </span>PDF
          </Button>
        </div>
      </div>

      {/* Date range filter */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex-1 sm:flex-initial">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">De</label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full sm:w-40" />
        </div>
        <div className="flex-1 sm:flex-initial">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">Até</label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full sm:w-40" />
        </div>
      </div>

      {/* Summary */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 sm:gap-4">
        {[
          { label: 'Total Entradas', value: totalIncome, color: 'text-green-600' },
          { label: 'Total Saídas', value: totalExpense, color: 'text-red-600' },
          { label: 'Resultado', value: totalIncome - totalExpense, color: totalIncome - totalExpense >= 0 ? 'text-primary' : 'text-red-600' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              {isLoading ? (
                <Skeleton className="mt-1 h-7 w-32" />
              ) : (
                <p className={`mt-1 text-2xl font-bold ${s.color}`}>{formatBRL(s.value)}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Bar chart: income vs expense by category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Gastos por Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : categoryData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Nenhum dado</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryData} layout="vertical" margin={{ left: 60 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tickFormatter={(v) => formatBRL(v)} tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Pie chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="mx-auto h-64 w-64 rounded-full" />
            ) : categoryData.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">Nenhum dado</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={categoryData} cx="50%" cy="50%" outerRadius={90} dataKey="value">
                    {categoryData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatBRL(v)} />
                  <Legend formatter={(v) => <span className="text-xs">{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transaction count */}
      <Card>
        <CardContent className="p-5">
          <p className="text-sm text-muted-foreground">
            {transactions.length} transações no período selecionado
          </p>
        </CardContent>
      </Card>

      {/* Preview modal */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Pré-visualização do Relatório
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            {/* Period */}
            <p className="text-muted-foreground">
              Período: <span className="font-medium text-foreground">{fmtDatePT(startDate)}</span> até{' '}
              <span className="font-medium text-foreground">{fmtDatePT(endDate)}</span>
            </p>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md bg-green-50 p-3 text-center dark:bg-green-950">
                <p className="text-xs text-muted-foreground">Entradas</p>
                <p className="font-bold text-green-600">{formatBRL(totalIncome)}</p>
              </div>
              <div className="rounded-md bg-red-50 p-3 text-center dark:bg-red-950">
                <p className="text-xs text-muted-foreground">Saídas</p>
                <p className="font-bold text-red-600">{formatBRL(totalExpense)}</p>
              </div>
              <div className={`rounded-md p-3 text-center ${result >= 0 ? 'bg-blue-50 dark:bg-blue-950' : 'bg-red-50 dark:bg-red-950'}`}>
                <p className="text-xs text-muted-foreground">Resultado</p>
                <p className={`font-bold ${result >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatBRL(result)}</p>
              </div>
            </div>

            {/* Category breakdown preview */}
            {categoryData.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Gastos por Categoria ({categoryData.length})</p>
                <div className="max-h-40 overflow-y-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-1.5 text-left">Categoria</th>
                        <th className="p-1.5 text-right">Valor</th>
                        <th className="p-1.5 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categoryData.map((c) => (
                        <tr key={c.name} className="border-t">
                          <td className="p-1.5 flex items-center gap-1.5">
                            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                            {c.name}
                          </td>
                          <td className="p-1.5 text-right">{formatBRL(c.value)}</td>
                          <td className="p-1.5 text-right">{totalExpense > 0 ? ((c.value / totalExpense) * 100).toFixed(1) : '0'}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Budget preview */}
            {budgetSummary.length > 0 && (
              <div>
                <p className="mb-1 font-medium">Orçamentos ({budgetSummary.length})</p>
                <div className="max-h-32 overflow-y-auto rounded border">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-muted">
                      <tr>
                        <th className="p-1.5 text-left">Categoria</th>
                        <th className="p-1.5 text-right">Orçado</th>
                        <th className="p-1.5 text-right">Gasto</th>
                        <th className="p-1.5 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {budgetSummary.map((b) => (
                        <tr key={b.id} className="border-t">
                          <td className="p-1.5">{b.categoryName}</td>
                          <td className="p-1.5 text-right">{formatBRL(b.budgeted)}</td>
                          <td className="p-1.5 text-right">{formatBRL(b.spent)}</td>
                          <td className={`p-1.5 text-right font-medium ${b.percentage > 100 ? 'text-red-600' : b.percentage > 80 ? 'text-yellow-600' : 'text-green-600'}`}>
                            {b.percentage.toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Checkboxes */}
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-xs font-medium text-muted-foreground uppercase">Incluir no PDF</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeCategoryTotals}
                  onChange={(e) => setIncludeCategoryTotals(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Gastos totais por categoria
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeBudgets}
                  onChange={(e) => setIncludeBudgets(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                Orçamentos
              </label>
            </div>

            {/* Transaction count */}
            <p className="text-muted-foreground">{transactions.length} transações serão incluídas</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancelar
            </Button>
            <Button onClick={handleExportPDF}>
              <FileText className="mr-2 h-4 w-4" />
              Exportar PDF
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
