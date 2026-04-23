'use client';

import Link from 'next/link';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatDate } from '@/lib/formatters';
import { useTransactions } from '@/hooks/useTransactions';
import type { Transaction } from '@finance-app/shared';

export function RecentTransactions() {
  const { data, isLoading } = useTransactions({ limit: 6 });
  const transactions = (data?.data ?? []) as unknown as Transaction[];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Últimas Transações</CardTitle>
        <Link href="/transactions" className="text-xs text-primary hover:underline">
          Ver todas
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))
        ) : transactions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Nenhuma transação este mês
          </p>
        ) : (
          transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-muted/50"
            >
              <div
                className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                  tx.type === 'INCOME'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                }`}
              >
                {tx.type === 'INCOME' ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{tx.description}</p>
                <p className="text-xs text-muted-foreground">
                  {tx.category?.name} · {formatDate(tx.date)}
                </p>
              </div>
              <span
                className={`text-sm font-semibold ${
                  tx.type === 'INCOME' ? 'text-green-600' : 'text-red-500'
                }`}
              >
                {tx.type === 'INCOME' ? '+' : '-'}
                {formatBRL(Math.abs(Number(tx.amount)))}
              </span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
