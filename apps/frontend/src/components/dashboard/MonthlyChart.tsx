'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatMonthLabel } from '@/lib/formatters';
import { TOOLTIP_STYLE } from '@/lib/chartUtils';
import type { MonthlyData } from '@finance-app/shared';

interface MonthlyChartProps {
  data?: MonthlyData[];
  isLoading?: boolean;
}

const TooltipContent = ({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="px-3 py-2">
      <p className="mb-2 text-xs font-medium opacity-70">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <span className="h-2 w-2 rounded-full" style={{ background: p.color }} />
          <span className="opacity-70">{p.name}:</span>
          <span className="font-semibold">{formatBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export function MonthlyChart({ data, isLoading }: MonthlyChartProps) {
  const chartData = (data ?? []).map((d) => ({
    ...d,
    month: formatMonthLabel(d.month),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Evolução Mensal (12 meses)</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                className="fill-muted-foreground"
              />
              <Tooltip content={<TooltipContent />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="income"
                name="Entradas"
                stroke="#22c55e"
                strokeWidth={2}
                fill="url(#incomeGrad)"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="expense"
                name="Saídas"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#expenseGrad)"
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
              <Area
                type="monotone"
                dataKey="balance"
                name="Saldo"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#balanceGrad)"
                strokeDasharray="5 5"
                dot={{ r: 3 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
