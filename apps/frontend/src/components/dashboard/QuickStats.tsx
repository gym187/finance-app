'use client';

import { TrendingUp, TrendingDown, Wallet, Percent, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string;
  trend?: number;
  trendLabel?: string;
  icon: React.ReactNode;
  iconBg: string;
  href?: string;
  isLoading?: boolean;
  valueColor?: string;
}

function StatCard({ title, value, trend, trendLabel, icon, iconBg, href, isLoading, valueColor }: StatCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const content = (
    <Card className={cn('transition-shadow', href && 'cursor-pointer hover:shadow-md')}>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
            <p className={cn('mt-1.5 text-2xl font-bold tracking-tight', valueColor)}>{value}</p>
            {trend !== undefined && (
              <div className="mt-1.5 flex items-center gap-1 text-xs">
                {trend >= 0 ? (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                ) : (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                <span className={trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                  {Math.abs(trend).toFixed(1)}% {trendLabel ?? 'vs mês anterior'}
                </span>
              </div>
            )}
          </div>
          <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', iconBg)}>
            {icon}
          </div>
        </div>
        {href && (
          <div className="mt-3 flex items-center gap-1 text-xs text-primary">
            <span>Ver detalhes</span>
            <ArrowRight className="h-3 w-3" />
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}

interface QuickStatsProps {
  balance?: number;
  totalIncome?: number;
  totalExpense?: number;
  savingsRate?: number;
  balanceVariation?: number;
  isLoading?: boolean;
}

export function QuickStats({
  balance,
  totalIncome,
  totalExpense,
  savingsRate,
  balanceVariation,
  isLoading,
}: QuickStatsProps) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
      <StatCard
        title="Saldo Acumulado"
        value={formatBRL(balance ?? 0)}
        trend={balanceVariation}
        icon={<Wallet className="h-5 w-5 text-blue-600" />}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        isLoading={isLoading}
        valueColor={(balance ?? 0) >= 0 ? 'text-foreground' : 'text-red-500'}
      />
      <StatCard
        title="Entradas do Mês"
        value={formatBRL(totalIncome ?? 0)}
        icon={<TrendingUp className="h-5 w-5 text-green-600" />}
        iconBg="bg-green-100 dark:bg-green-900/30"
        href="/transactions?type=INCOME"
        isLoading={isLoading}
        valueColor="text-green-600"
      />
      <StatCard
        title="Saídas do Mês"
        value={formatBRL(totalExpense ?? 0)}
        icon={<TrendingDown className="h-5 w-5 text-red-500" />}
        iconBg="bg-red-100 dark:bg-red-900/30"
        href="/transactions?type=EXPENSE"
        isLoading={isLoading}
        valueColor="text-red-500"
      />
      <StatCard
        title="Taxa de Economia"
        value={formatPercent(savingsRate ?? 0)}
        icon={<Percent className="h-5 w-5 text-purple-600" />}
        iconBg="bg-purple-100 dark:bg-purple-900/30"
        isLoading={isLoading}
        valueColor={(savingsRate ?? 0) >= 20 ? 'text-green-600' : (savingsRate ?? 0) >= 0 ? 'text-foreground' : 'text-red-500'}
      />
    </div>
  );
}
