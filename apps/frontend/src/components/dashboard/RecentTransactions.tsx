'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL } from '@/lib/formatters';
import { useTransactions } from '@/hooks/useTransactions';
import { cn } from '@/lib/utils';
import type { Transaction } from '@finance-app/shared';

function formatShortDate(dateStr: string) {
  const d = new Date(dateStr);
  const day = d.toLocaleDateString('pt-BR', { timeZone: 'UTC', day: 'numeric' });
  const month = d.toLocaleDateString('pt-BR', { timeZone: 'UTC', month: 'short' }).replace('.', '');
  return { day, month };
}

export function RecentTransactions() {
  const { data, isLoading } = useTransactions({ limit: 8 });
  const transactions = (data?.data ?? []) as unknown as (Transaction & {
    category?: { name: string; color?: string };
  })[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Transações recentes</CardTitle>
        <Link href="/transactions" className="text-xs text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="px-4 pb-2">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="h-8 w-12 rounded" />
                <Skeleton className="h-full w-0.5 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-3.5 w-40" />
                </div>
                <div className="space-y-1 text-right">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3.5 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma transação registrada
          </p>
        ) : (
          <div>
            {transactions.map((tx, i) => {
              const { day, month } = formatShortDate(tx.date);
              const isIncome = tx.type === 'INCOME';
              const catColor = tx.category?.color ?? (isIncome ? '#6FA981' : '#CD7C6B');
              return (
                <div
                  key={tx.id}
                  className={cn(
                    'flex items-center gap-4 py-3',
                    i < transactions.length - 1 && 'border-b'
                  )}
                >
                  {/* Date */}
                  <div className="w-10 flex-shrink-0 text-center">
                    <p className="text-sm font-semibold leading-none">{day}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">de {month}.</p>
                  </div>

                  {/* Color bar */}
                  <span
                    className="h-8 w-0.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: catColor }}
                  />

                  {/* Description */}
                  <p className="flex-1 truncate text-sm font-medium">{tx.description}</p>

                  {/* Category + amount */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-muted-foreground">{tx.category?.name ?? '—'}</p>
                    <p className={cn(
                      'text-sm font-semibold font-[family-name:var(--font-roboto-mono)]',
                      isIncome ? 'text-income' : 'text-expense'
                    )}>
                      {isIncome ? '+' : '-'}{formatBRL(Math.abs(Number(tx.amount)))}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
