'use client';

import { CheckCircle2, AlertTriangle, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatBRL } from '@/lib/formatters';

interface FinancialHealthBarProps {
  totalIncome?: number;
  totalExpense?: number;
  savingsRate?: number;
  budgetCount?: number;
  budgetAlerts?: number;
  isLoading?: boolean;
}

function scoreLabel(score: number) {
  if (score >= 80) return { label: 'Excelente', color: 'text-green-600', bg: 'bg-green-500' };
  if (score >= 60) return { label: 'Bom', color: 'text-blue-600', bg: 'bg-blue-500' };
  if (score >= 40) return { label: 'Regular', color: 'text-amber-600', bg: 'bg-amber-500' };
  return { label: 'Atenção', color: 'text-red-600', bg: 'bg-red-500' };
}

export function FinancialHealthBar({
  totalIncome = 0,
  totalExpense = 0,
  savingsRate = 0,
  budgetAlerts = 0,
  isLoading,
}: FinancialHealthBarProps) {
  // Score: savings rate (50pts) + no budget alerts (30pts) + positive balance (20pts)
  const savingsScore = Math.min(50, Math.max(0, savingsRate) * 2.5);
  const alertScore = budgetAlerts === 0 ? 30 : budgetAlerts <= 1 ? 15 : 0;
  const balanceScore = totalIncome >= totalExpense ? 20 : 0;
  const score = Math.round(savingsScore + alertScore + balanceScore);
  const { label, color, bg } = scoreLabel(score);

  const result = totalIncome - totalExpense;

  const indicators = [
    {
      label: 'Resultado do mês',
      value: formatBRL(result),
      ok: result >= 0,
      hint: result >= 0 ? 'Saldo positivo' : 'Gastos acima da renda',
    },
    {
      label: 'Taxa de economia',
      value: `${savingsRate.toFixed(1)}%`,
      ok: savingsRate >= 10,
      hint: savingsRate >= 10 ? 'Acima de 10% — ótimo!' : 'Meta: poupar pelo menos 10%',
    },
    {
      label: 'Alertas de orçamento',
      value: `${budgetAlerts} alerta${budgetAlerts !== 1 ? 's' : ''}`,
      ok: budgetAlerts === 0,
      hint: budgetAlerts === 0 ? 'Tudo dentro do planejado' : 'Revise seus orçamentos',
    },
  ];

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3 w-full rounded-full" />
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="h-4 w-4 text-primary" />
          Saúde Financeira
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score bar */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Score do mês</span>
            <span className={cn('font-bold', color)}>{score}/100 — {label}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn('h-full rounded-full transition-all duration-700', bg)}
              style={{ width: `${score}%` }}
            />
          </div>
        </div>

        {/* Indicators */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {indicators.map((ind) => (
            <div
              key={ind.label}
              className={cn(
                'flex flex-col gap-1 rounded-lg border p-3',
                ind.ok
                  ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/10'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/10'
              )}
            >
              <div className="flex items-center gap-1.5">
                {ind.ok ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                ) : (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                )}
                <span className="text-xs text-muted-foreground">{ind.label}</span>
              </div>
              <span className={cn('text-sm font-bold', ind.ok ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400')}>
                {ind.value}
              </span>
              <span className="text-xs text-muted-foreground">{ind.hint}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
