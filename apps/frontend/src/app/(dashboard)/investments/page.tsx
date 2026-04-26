'use client';

import { useState } from 'react';
import { Plus, RefreshCw, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InvestmentSummaryCards } from '@/components/investments/InvestmentSummaryCards';
import { AllocationChart } from '@/components/investments/AllocationChart';
import { HoldingsTable } from '@/components/investments/HoldingsTable';
import { InvestmentModal } from '@/components/investments/InvestmentModal';
import { useInvestmentSummary, useInvestmentMutations } from '@/hooks/useInvestments';
import { formatBRL, formatPercent } from '@/lib/formatters';
import type { InvestmentHolding } from '@/hooks/useInvestments';

export default function InvestmentsPage() {
  const { data: summary, isLoading, refetch } = useInvestmentSummary();
  const { create, update, remove } = useInvestmentMutations();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingHolding, setEditingHolding] = useState<InvestmentHolding | null>(null);
  const [targetInput, setTargetInput] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem('investmentTarget') ?? '';
  });

  const targetAmount = parseFloat(targetInput) || 0;

  const handleTargetBlur = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('investmentTarget', targetInput);
    }
  };

  const handleOpenNew = () => {
    setEditingHolding(null);
    setModalOpen(true);
  };

  const handleEdit = (holding: InvestmentHolding) => {
    setEditingHolding(holding);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este ativo?')) return;
    await remove.mutateAsync(id);
  };

  const handleSubmit = async (data: unknown) => {
    if (editingHolding) {
      await update.mutateAsync({ id: editingHolding.id, data });
    } else {
      await create.mutateAsync(data);
    }
    setModalOpen(false);
  };

  const isMutating = create.isPending || update.isPending;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Investimentos</h2>
          <p className="text-sm text-muted-foreground">Acompanhe sua carteira e patrimônio</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
          <Button size="sm" onClick={handleOpenNew}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Ativo
          </Button>
        </div>
      </div>

      {/* KPI cards */}
      <InvestmentSummaryCards summary={summary} isLoading={isLoading} />

      {/* Investment target */}
      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium min-w-fit">
            <Target className="h-4 w-4 text-primary" />
            Meta de Patrimônio
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[180px] max-w-xs">
            <span className="text-sm text-muted-foreground">R$</span>
            <Input
              type="number"
              step="1000"
              min="0"
              placeholder="Ex: 100000"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              onBlur={handleTargetBlur}
              className="h-8 text-sm"
            />
          </div>
          {targetAmount > 0 && summary && (
            <div className="flex flex-1 flex-col gap-1 min-w-[200px]">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{formatBRL(summary.currentValue)} atual</span>
                <span>{formatPercent((summary.currentValue / targetAmount) * 100)} da meta</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (summary.currentValue / targetAmount) * 100)}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Faltam {formatBRL(Math.max(0, targetAmount - summary.currentValue))} para atingir a meta
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Allocation chart + top holdings */}
      <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
        <AllocationChart allocation={summary?.allocation} isLoading={isLoading} />

        {/* Return by type */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Performance per class */}
          {summary && summary.allocation.length > 0 && (
            <div className="rounded-xl border bg-card p-5">
              <p className="mb-3 text-sm font-semibold">Performance por Classe</p>
              <div className="space-y-3">
                {summary.allocation.map((a) => {
                  const ret = a.value - a.invested;
                  const retPct = a.invested > 0 ? (ret / a.invested) * 100 : 0;
                  return (
                    <div key={a.type} className="flex items-center gap-3 text-sm">
                      <span
                        className="h-3 w-3 flex-shrink-0 rounded-full"
                        style={{ backgroundColor: a.color }}
                      />
                      <span className="flex-1 font-medium">{a.label}</span>
                      <span className="text-muted-foreground">{a.count} ativo{a.count !== 1 ? 's' : ''}</span>
                      <span className={retPct >= 0 ? 'font-semibold text-green-600' : 'font-semibold text-red-500'}>
                        {retPct >= 0 ? '+' : ''}{retPct.toFixed(2)}%
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Quick note */}
          <div className="rounded-xl border bg-muted/30 p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">💡 Dica</p>
            <p className="mt-1">
              Mantenha o preço atual dos seus ativos atualizado para ter uma visão precisa do
              rendimento. Defina metas de alocação para manter a diversificação ideal.
            </p>
          </div>
        </div>
      </div>

      {/* Holdings table */}
      <HoldingsTable
        holdings={summary?.holdings}
        isLoading={isLoading}
        targetAmount={targetAmount > 0 ? targetAmount : undefined}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* Modal */}
      <InvestmentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleSubmit}
        editing={editingHolding}
        isLoading={isMutating}
      />
    </div>
  );
}
