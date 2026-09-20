'use client';

import Link from 'next/link';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { useInvestmentSummary } from '@/hooks/useInvestments';

const TYPE_COLORS: Record<string, string> = {
  STOCK:        '#3b82f6',
  FII:          '#10b981',
  ETF:          '#8b5cf6',
  CRYPTO:       '#f59e0b',
  FIXED_INCOME: '#06b6d4',
  OTHER:        '#6b7280',
};

export function InvestmentsWidget() {
  const { data, isLoading } = useInvestmentSummary();

  const isPositive = (data?.totalReturn ?? 0) >= 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Carteira de Investimentos</CardTitle>
        <Link href="/investments" className="text-xs text-primary hover:underline">
          Ver todos
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-1.5 rounded-lg border p-2.5">
                <Skeleton className="h-3 w-12" />
                <Skeleton className="h-4 w-full" />
              </div>
            ))
          ) : (
            <>
              <div className="min-w-0 rounded-lg border p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                  Investido
                </p>
                <p className="mt-1 text-xs font-bold font-[family-name:var(--font-roboto-mono)] truncate">
                  {formatBRL(data?.totalInvested ?? 0)}
                </p>
              </div>
              <div className="min-w-0 rounded-lg border p-2.5">
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                  Valor Atual
                </p>
                <p className="mt-1 text-xs font-bold font-[family-name:var(--font-roboto-mono)] truncate">
                  {formatBRL(data?.currentValue ?? 0)}
                </p>
              </div>
              <div className={cn(
                'min-w-0 rounded-lg border p-2.5',
                isPositive
                  ? 'border-income/30 bg-income/5'
                  : 'border-expense/30 bg-expense/5'
              )}>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
                  Retorno
                </p>
                <div className="mt-1 flex items-center gap-0.5">
                  {isPositive
                    ? <TrendingUp className="h-3 w-3 flex-shrink-0 text-income" />
                    : <TrendingDown className="h-3 w-3 flex-shrink-0 text-expense" />}
                  <p className={cn(
                    'text-xs font-bold font-[family-name:var(--font-roboto-mono)] truncate',
                    isPositive ? 'text-income' : 'text-expense'
                  )}>
                    {(data?.totalReturnPct ?? 0) >= 0 ? '+' : ''}{(data?.totalReturnPct ?? 0).toFixed(2)}%
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Holdings list */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5">
                <Skeleton className="h-4 w-1 rounded-full" />
                <Skeleton className="h-3.5 w-32" />
                <div className="ml-auto space-y-1 text-right">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3.5 w-20" />
                </div>
              </div>
            ))}
          </div>
        ) : !data?.holdings.length ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Nenhum investimento cadastrado
          </p>
        ) : (
          <div>
            {data.holdings.slice(0, 5).map((h, i) => (
              <div
                key={h.id}
                className={cn(
                  'flex items-center gap-3 py-2.5',
                  i < Math.min(data.holdings.length, 5) - 1 && 'border-b'
                )}
              >
                <span
                  className="h-5 w-0.5 flex-shrink-0 rounded-full"
                  style={{ backgroundColor: TYPE_COLORS[h.type] ?? '#6b7280' }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {h.ticker ?? h.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{h.typeLabel}</p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold font-[family-name:var(--font-roboto-mono)]">
                    {formatBRL(h.currentValue)}
                  </p>
                  <p className={cn(
                    'text-xs font-medium',
                    h.returnPct >= 0 ? 'text-income' : 'text-expense'
                  )}>
                    {h.returnPct >= 0 ? '+' : ''}{h.returnPct.toFixed(2)}%
                  </p>
                </div>
              </div>
            ))}
            {data.holdings.length > 5 && (
              <p className="pt-2 text-xs text-muted-foreground">
                +{data.holdings.length - 5} ativos
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
