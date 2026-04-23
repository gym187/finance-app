'use client';

import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { TrendingUp, TrendingDown, Info } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL } from '@/lib/formatters';
import { useProjection } from '@/hooks/useProjection';

function TooltipContent({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2.5 shadow-lg text-popover-foreground space-y-1.5">
      <p className="font-semibold text-sm">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
          <span className="opacity-70">{p.name}:</span>
          <span className={`font-semibold ${p.value >= 0 ? '' : 'text-red-500'}`}>{formatBRL(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function WealthProjection() {
  const { data, isLoading } = useProjection();

  const optimistic12 = data?.projection[data.projection.length - 1]?.optimistic ?? 0;
  const conservative12 = data?.projection[data.projection.length - 1]?.conservative ?? 0;
  const current = data?.currentBalance ?? 0;

  const optChange = optimistic12 - current;
  const conChange = conservative12 - current;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" />
            Projeção de Patrimônio — 12 meses
          </CardTitle>
        </div>
        {!isLoading && data && (
          <div className="mt-2 flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 dark:bg-blue-900/10">
              <TrendingUp className="h-3.5 w-3.5 text-blue-600" />
              <span className="text-xs">
                <span className="text-muted-foreground">Otimista: </span>
                <span className={`font-semibold ${optChange >= 0 ? 'text-blue-600' : 'text-red-500'}`}>
                  {formatBRL(optimistic12)}
                  <span className="ml-1 text-[10px]">({optChange >= 0 ? '+' : ''}{formatBRL(optChange)})</span>
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs">
                <span className="text-muted-foreground">Conservadora: </span>
                <span className={`font-semibold ${conChange >= 0 ? 'text-foreground' : 'text-red-500'}`}>
                  {formatBRL(conservative12)}
                  <span className="ml-1 text-[10px]">({conChange >= 0 ? '+' : ''}{formatBRL(conChange)})</span>
                </span>
              </span>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !data || data.projection.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">Sem dados suficientes para projeção</p>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.projection} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradOpt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradCon" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6b7280" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6b7280" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => {
                    if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(0)}k`;
                    return String(v);
                  }}
                  tick={{ fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={45}
                />
                <Tooltip content={<TooltipContent />} />
                <Legend
                  formatter={(v) => <span className="text-xs">{v}</span>}
                  iconType="circle"
                  iconSize={8}
                />
                {current !== 0 && (
                  <ReferenceLine
                    y={current}
                    stroke="#9ca3af"
                    strokeDasharray="4 4"
                    label={{ value: 'Atual', position: 'right', fontSize: 9, fill: '#9ca3af' }}
                  />
                )}
                <Area
                  type="monotone"
                  dataKey="optimistic"
                  name="Otimista"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#gradOpt)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="conservative"
                  name="Conservadora"
                  stroke="#6b7280"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  fill="url(#gradCon)"
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </AreaChart>
            </ResponsiveContainer>

            <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <p className="flex items-start gap-1.5">
                <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>
                  <strong className="text-foreground">Otimista</strong> — mantém a média histórica de{' '}
                  <strong className="text-foreground">{formatBRL(data.historicalAvgMonthly)}/mês</strong> dos últimos 6 meses.{' '}
                  <strong className="text-foreground">Conservadora</strong> — considera apenas as recorrências fixas ativas
                  ({formatBRL(data.recurringMonthlyNet)}/mês líquido).
                </span>
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
