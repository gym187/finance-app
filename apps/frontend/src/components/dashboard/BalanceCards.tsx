'use client';

import { TrendingUp, TrendingDown, Wallet, Percent } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: number;
  isBRL?: boolean;
  isPercent?: boolean;
  trend?: number;
  icon: React.ReactNode;
  iconBg: string;
  isLoading?: boolean;
}

function StatCard({ title, value, isBRL, isPercent, trend, icon, iconBg, isLoading }: StatCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-6">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="h-8 w-32" />
        </CardContent>
      </Card>
    );
  }

  const displayValue = isBRL
    ? formatBRL(value)
    : isPercent
    ? formatPercent(value)
    : value.toLocaleString('pt-BR');

  return (
    <Card className="animate-fade-in">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="mt-1 text-2xl font-bold">{displayValue}</p>
            {trend !== undefined && (
              <div className="mt-1 flex items-center gap-1 text-xs">
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={trend >= 0 ? 'text-green-600' : 'text-red-600'}>
                  {Math.abs(trend).toFixed(1)}% vs mês anterior
                </span>
              </div>
            )}
          </div>
          <div className={cn('flex h-12 w-12 items-center justify-center rounded-xl', iconBg)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface BalanceCardsProps {
  balance?: number;
  totalIncome?: number;
  totalExpense?: number;
  savingsRate?: number;
  balanceVariation?: number;
  isLoading?: boolean;
}

export function BalanceCards({
  balance,
  totalIncome,
  totalExpense,
  savingsRate,
  balanceVariation,
  isLoading,
}: BalanceCardsProps) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
      <StatCard
        title="Saldo Total"
        value={balance ?? 0}
        isBRL
        trend={balanceVariation}
        icon={<Wallet className="h-6 w-6 text-blue-600" />}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        isLoading={isLoading}
      />
      <StatCard
        title="Entradas do Mês"
        value={totalIncome ?? 0}
        isBRL
        icon={<TrendingUp className="h-6 w-6 text-green-600" />}
        iconBg="bg-green-100 dark:bg-green-900/30"
        isLoading={isLoading}
      />
      <StatCard
        title="Saídas do Mês"
        value={totalExpense ?? 0}
        isBRL
        icon={<TrendingDown className="h-6 w-6 text-red-600" />}
        iconBg="bg-red-100 dark:bg-red-900/30"
        isLoading={isLoading}
      />
      <StatCard
        title="Taxa de Economia"
        value={savingsRate ?? 0}
        isPercent
        icon={<Percent className="h-6 w-6 text-purple-600" />}
        iconBg="bg-purple-100 dark:bg-purple-900/30"
        isLoading={isLoading}
      />
    </div>
  );
}
