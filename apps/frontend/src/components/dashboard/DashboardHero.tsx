'use client';

import { formatBRL } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';

interface DashboardHeroProps {
  balance?: number;
  totalIncome?: number;
  totalExpense?: number;
  savingsRate?: number;
  isLoading?: boolean;
}

export function DashboardHero({ balance, totalIncome, totalExpense, savingsRate, isLoading }: DashboardHeroProps) {
  const income = totalIncome ?? 0;
  const expense = totalExpense ?? 0;
  const rate = savingsRate ?? 0;
  const committedPct = income > 0 ? Math.min(100, (expense / income) * 100) : 0;

  const stats = [
    { label: 'Entradas', value: income, color: 'text-income' },
    { label: 'Saídas', value: expense, color: 'text-expense' },
    { label: 'Investido', value: 0, color: 'text-muted-foreground' },
  ];

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-stretch">
        {/* Left: balance principal */}
        <div className="flex-1 min-w-0 p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
            Saldo do Mês
          </p>
          {isLoading ? (
            <div className="mt-2 space-y-3">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="mt-4 h-1.5 w-full rounded-full" />
            </div>
          ) : (
            <>
              <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-4xl font-bold tracking-tight sm:text-5xl font-[family-name:var(--font-roboto-mono)]">
                  {formatBRL(balance ?? 0)}
                </span>
                <span className="text-sm text-muted-foreground">
                  <span className="font-semibold text-foreground">{rate.toFixed(0)}%</span>{' '}
                  taxa de poupança
                </span>
              </div>
              <div className="mt-4 space-y-1.5">
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-700"
                    style={{ width: `${committedPct}%` }}
                  />
                </div>
                <p className="text-right text-xs text-muted-foreground">
                  {committedPct.toFixed(0)}% da renda comprometida
                </p>
              </div>
            </>
          )}
        </div>

        {/* Right: mini stats */}
        <div className="hidden sm:flex flex-shrink-0 border-l bg-muted/20">
          {stats.map((s, i) => (
            <div key={s.label} className={`flex flex-col justify-center px-6 py-5 text-center${i > 0 ? ' border-l' : ''}`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                {s.label}
              </p>
              {isLoading ? (
                <Skeleton className="mt-1.5 h-5 w-24 mx-auto" />
              ) : (
                <p className={`mt-1 text-sm font-bold font-[family-name:var(--font-roboto-mono)] ${s.color}`}>
                  {formatBRL(s.value)}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
