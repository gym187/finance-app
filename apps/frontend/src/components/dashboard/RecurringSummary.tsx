'use client';

import Link from 'next/link';
import { Repeat2, ArrowUpRight, ArrowDownRight, CalendarClock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { FREQ_LABELS } from '@/hooks/useRecurring';
import type { RecurrencyFreq } from '@/hooks/useRecurring';

interface RecurringItem {
  id: number;
  description: string;
  amount: number;
  type: 'INCOME' | 'EXPENSE';
  frequency: string;
  nextDueDate: string;
  categoryName: string;
  categoryColor: string;
}

interface RecurringSummaryProps {
  recurringIncome?: number;
  recurringExpense?: number;
  recurringItems?: RecurringItem[];
  isLoading?: boolean;
}

export function RecurringSummary({
  recurringIncome = 0,
  recurringExpense = 0,
  recurringItems = [],
  isLoading,
}: RecurringSummaryProps) {
  if (!isLoading && recurringItems.length === 0) return null;

  const sorted = [...recurringItems].sort(
    (a, b) => new Date(a.nextDueDate).getTime() - new Date(b.nextDueDate).getTime()
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Repeat2 className="h-4 w-4 text-primary" />
            Recorrentes Ativos
          </CardTitle>
          <Link href="/recurring" className="text-xs text-primary hover:underline">
            Gerenciar
          </Link>
        </div>

        {/* Mini summary */}
        {!isLoading && (recurringIncome > 0 || recurringExpense > 0) && (
          <div className="mt-2 flex gap-3">
            {recurringIncome > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-1.5 dark:bg-green-900/10">
                <ArrowUpRight className="h-3.5 w-3.5 text-green-600" />
                <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                  +{formatBRL(recurringIncome)}/recorrência
                </span>
              </div>
            )}
            {recurringExpense > 0 && (
              <div className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 dark:bg-red-900/10">
                <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />
                <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                  -{formatBRL(recurringExpense)}/recorrência
                </span>
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-1">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-8 w-8 rounded-full" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <Skeleton className="h-4 w-20" />
            </div>
          ))
        ) : (
          sorted.slice(0, 5).map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-muted/50"
            >
              <div
                className={cn(
                  'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full',
                  item.type === 'INCOME'
                    ? 'bg-green-100 dark:bg-green-900/30'
                    : 'bg-red-100 dark:bg-red-900/30'
                )}
              >
                {item.type === 'INCOME' ? (
                  <ArrowUpRight className="h-4 w-4 text-green-600" />
                ) : (
                  <ArrowDownRight className="h-4 w-4 text-red-500" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{item.description}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className="inline-flex items-center gap-1"
                    style={{ color: item.categoryColor }}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: item.categoryColor }}
                    />
                    {item.categoryName}
                  </span>
                  <span>·</span>
                  <span>{FREQ_LABELS[item.frequency as RecurrencyFreq]}</span>
                  <span>·</span>
                  <span className="flex items-center gap-0.5">
                    <CalendarClock className="h-3 w-3" />
                    {formatDate(item.nextDueDate)}
                  </span>
                </div>
              </div>

              <span
                className={cn(
                  'flex-shrink-0 text-sm font-semibold',
                  item.type === 'INCOME' ? 'text-green-600' : 'text-red-500'
                )}
              >
                {item.type === 'INCOME' ? '+' : '-'}
                {formatBRL(item.amount)}
              </span>
            </div>
          ))
        )}

        {sorted.length > 5 && (
          <Link
            href="/recurring"
            className="block pt-1 text-center text-xs text-primary hover:underline"
          >
            +{sorted.length - 5} recorrências → ver todas
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
