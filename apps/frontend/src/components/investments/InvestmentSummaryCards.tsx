'use client';

import { TrendingUp, TrendingDown, DollarSign, PieChart, LayoutGrid } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { InvestmentSummary } from '@/hooks/useInvestments';

interface CardItemProps {
  title: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  iconBg: string;
  valueColor?: string;
  isLoading?: boolean;
}

function CardItem({ title, value, sub, icon, iconBg, valueColor, isLoading }: CardItemProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-11 w-11 rounded-xl" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className={cn('mt-1.5 text-2xl font-bold tracking-tight', valueColor)}>{value}</p>
            {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={cn('flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl', iconBg)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface Props {
  summary?: InvestmentSummary;
  isLoading?: boolean;
}

export function InvestmentSummaryCards({ summary, isLoading }: Props) {
  const returnPositive = (summary?.totalReturn ?? 0) >= 0;

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 sm:gap-4">
      <CardItem
        title="Total Investido"
        value={formatBRL(summary?.totalInvested ?? 0)}
        sub={`${summary?.count ?? 0} ativo${(summary?.count ?? 0) !== 1 ? 's' : ''}`}
        icon={<DollarSign className="h-5 w-5 text-blue-600" />}
        iconBg="bg-blue-100 dark:bg-blue-900/30"
        isLoading={isLoading}
      />
      <CardItem
        title="Valor Atual"
        value={formatBRL(summary?.currentValue ?? 0)}
        icon={<PieChart className="h-5 w-5 text-purple-600" />}
        iconBg="bg-purple-100 dark:bg-purple-900/30"
        isLoading={isLoading}
      />
      <CardItem
        title="Rendimento Total"
        value={formatBRL(summary?.totalReturn ?? 0)}
        sub={`${returnPositive ? '+' : ''}${formatPercent(summary?.totalReturnPct ?? 0)}`}
        icon={
          returnPositive ? (
            <TrendingUp className="h-5 w-5 text-green-600" />
          ) : (
            <TrendingDown className="h-5 w-5 text-red-500" />
          )
        }
        iconBg={returnPositive ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}
        valueColor={returnPositive ? 'text-green-600' : 'text-red-500'}
        isLoading={isLoading}
      />
      <CardItem
        title="Diversificação"
        value={`${summary?.allocation.length ?? 0} classe${(summary?.allocation.length ?? 0) !== 1 ? 's' : ''}`}
        sub={summary?.allocation.map((a) => a.label).join(', ') || '—'}
        icon={<LayoutGrid className="h-5 w-5 text-amber-600" />}
        iconBg="bg-amber-100 dark:bg-amber-900/30"
        isLoading={isLoading}
      />
    </div>
  );
}
