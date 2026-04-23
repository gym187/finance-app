'use client';

import Link from 'next/link';
import { CreditCard, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL } from '@/lib/formatters';

interface LoanItem {
  id: number;
  name: string;
  currentBalance: number;
  installmentAmount: number;
  nextDueDate: string;
}

interface LoansWidgetProps {
  loans?: LoanItem[];
  totalDebt?: number;
  isLoading?: boolean;
}

export function LoansWidget({ loans, totalDebt, isLoading }: LoansWidgetProps) {
  if (!isLoading && (!loans || loans.length === 0)) return null;

  const getDaysUntil = (date: string) => {
    const diff = new Date(date).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <CreditCard className="h-4 w-4 text-red-500" />
            Empréstimos
          </CardTitle>
          <Link href="/loans" className="text-xs text-primary hover:underline">Gerenciar</Link>
        </div>
        {!isLoading && totalDebt !== undefined && totalDebt > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Total em dívida: <span className="font-semibold text-red-500">{formatBRL(totalDebt)}</span>
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
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
          (loans ?? []).map((loan) => {
            const days = getDaysUntil(loan.nextDueDate);
            const urgent = days <= 5;
            return (
              <div key={loan.id} className="flex items-center gap-3 rounded-lg px-1 py-2 hover:bg-muted/50">
                <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${urgent ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted'}`}>
                  {urgent
                    ? <AlertTriangle className="h-4 w-4 text-red-500" />
                    : <CreditCard className="h-4 w-4 text-muted-foreground" />
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{loan.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Saldo: {formatBRL(loan.currentBalance)} ·{' '}
                    <span className={urgent ? 'text-red-500 font-medium' : ''}>
                      vence {days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`}
                    </span>
                  </p>
                </div>
                <span className="flex-shrink-0 text-sm font-semibold text-red-500">
                  {formatBRL(loan.installmentAmount)}
                </span>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
