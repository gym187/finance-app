'use client';

import { AlertTriangle, AlertCircle } from 'lucide-react';
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
  return (
    <div className="space-y-4">
      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <Card className="border-amber-200 dark:border-amber-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {alerts.map((alert, i) => (
              <div
                key={i}
                className={cn(
                  'flex items-start gap-2 rounded-lg p-3 text-sm',
                  alert.type === 'danger'
                    ? 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                )}
              >
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {alert.message}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Budget progress bars */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Orçamentos do Mês</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-2 w-full" />
              </div>
            ))
          ) : !budgetSummary || budgetSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum orçamento configurado.{' '}
              <a href="/budgets" className="text-primary hover:underline">
                Criar orçamento
              </a>
            </p>
          ) : (
            budgetSummary.map((b) => {
              const pct = Math.min(b.percentage, 100);
              const color =
                b.percentage >= 100
                  ? 'bg-red-500'
                  : b.percentage >= 80
                  ? 'bg-amber-500'
                  : 'bg-primary';
              return (
                <div key={b.id}>
                  <div className="mb-1.5 flex items-center justify-between text-sm">
                    <span className="font-medium">{b.categoryName}</span>
                    <span className="text-muted-foreground">
                      {formatBRL(b.spent)} / {formatBRL(b.budgeted)}{' '}
                      <span
                        className={cn(
                          'font-semibold',
                          b.percentage >= 100 ? 'text-red-500' : b.percentage >= 80 ? 'text-amber-500' : ''
                        )}
                      >
                        ({formatPercent(b.percentage)})
                      </span>
                    </span>
                  </div>
                  <Progress
                    value={pct}
                    className="h-2"
                    indicatorClassName={color}
                  />
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
