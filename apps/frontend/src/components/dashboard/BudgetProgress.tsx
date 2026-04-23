'use client';

import Link from 'next/link';
import { AlertTriangle, AlertCircle, CheckCircle2, Target } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { BudgetSummary, Alert } from '@finance-app/shared';

interface BudgetProgressProps {
  budgetSummary?: BudgetSummary[];
  alerts?: Alert[];
  isLoading?: boolean;
}

export function BudgetProgress({ budgetSummary, alerts, isLoading }: BudgetProgressProps) {
  const dangerCount = budgetSummary?.filter((b) => b.percentage >= 100).length ?? 0;
  const warningCount = budgetSummary?.filter((b) => b.percentage >= 80 && b.percentage < 100).length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Orçamentos do Mês
          </CardTitle>
          <div className="flex gap-2">
            {dangerCount > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-900/30 dark:text-red-400">
                {dangerCount} excedido{dangerCount > 1 ? 's' : ''}
              </span>
            )}
            {warningCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                {warningCount} alerta{warningCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Alerts inline */}
        {alerts && alerts.length > 0 && (
          <div className="space-y-1.5">
            {alerts.slice(0, 2).map((alert, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg p-2.5 text-xs',
                  alert.type === 'danger'
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                )}
              >
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                {alert.message}
              </div>
            ))}
            {alerts.length > 2 && (
              <p className="text-xs text-muted-foreground">+{alerts.length - 2} alertas adicionais</p>
            )}
          </div>
        )}

        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))
        ) : !budgetSummary || budgetSummary.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <Target className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum orçamento configurado.</p>
            <Link href="/budgets" className="text-xs text-primary hover:underline">
              Criar orçamento →
            </Link>
          </div>
        ) : (
          budgetSummary.map((b) => {
            const pct = Math.min(b.percentage, 100);
            const remaining = b.budgeted - b.spent;
            const isDanger = b.percentage >= 100;
            const isWarning = b.percentage >= 80 && !isDanger;
            const color = isDanger ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-primary';

            return (
              <div key={b.id} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-1.5">
                    {isDanger ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                    ) : isWarning ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    )}
                    <span className="font-medium">{b.categoryName}</span>
                  </div>
                  <span
                    className={cn(
                      'text-xs font-semibold',
                      isDanger ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-muted-foreground'
                    )}
                  >
                    {formatPercent(b.percentage, 0)}
                  </span>
                </div>
                <Progress value={pct} className="h-2" indicatorClassName={color} />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{formatBRL(b.spent)} gasto</span>
                  <span>
                    {remaining >= 0
                      ? `${formatBRL(remaining)} restante`
                      : `${formatBRL(Math.abs(remaining))} acima`}
                  </span>
                </div>
              </div>
            );
          })
        )}

        {budgetSummary && budgetSummary.length > 0 && (
          <Link href="/budgets" className="block text-center text-xs text-primary hover:underline">
            Gerenciar orçamentos →
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
