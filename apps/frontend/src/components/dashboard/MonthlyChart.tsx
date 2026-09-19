'use client';

import { useState } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatMonthLabel } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { MonthlyData } from '@finance-app/shared';

type Period = '30d' | '6m' | '1y' | 'all';

const PERIODS: { value: Period; label: string; months: number | null }[] = [
  { value: '30d', label: 'Últimos 30 dias', months: 1 },
  { value: '6m',  label: 'Últimos 6 meses', months: 6 },
  { value: '1y',  label: '1 ano',           months: 12 },
  { value: 'all', label: 'Todo período',    months: null },
];

const TooltipContent = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-popover-foreground text-xs">
      <p className="mb-1.5 font-medium text-muted-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold">{formatBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

interface MonthlyChartProps {
  data?: MonthlyData[];
  isLoading?: boolean;
}

export function MonthlyChart({ data, isLoading }: MonthlyChartProps) {
  const [period, setPeriod] = useState<Period>('6m');

  const selected = PERIODS.find((p) => p.value === period)!;

  const allFormatted = (data ?? []).map((d) => ({
    ...d,
    month: formatMonthLabel(d.month),
  }));

  const chartData = selected.months === null
    ? allFormatted
    : allFormatted.slice(-selected.months);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <CardTitle className="text-base">Entradas e saídas</CardTitle>
        <div className="flex flex-wrap justify-end gap-1">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={cn(
                'rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                period === p.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
              />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                className="fill-muted-foreground"
                width={48}
              />
              <Tooltip content={<TooltipContent />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              <Line
                type="monotone"
                dataKey="income"
                name="Entradas"
                stroke="#6FA981"
                strokeWidth={2}
                dot={{ r: 3, fill: '#6FA981' }}
                activeDot={{ r: 5 }}
              />
              <Line
                type="monotone"
                dataKey="expense"
                name="Saídas"
                stroke="#CD7C6B"
                strokeWidth={2}
                dot={{ r: 3, fill: '#CD7C6B' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
