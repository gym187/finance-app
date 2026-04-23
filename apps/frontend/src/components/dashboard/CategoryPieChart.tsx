'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatPercent } from '@/lib/formatters';
import type { CategoryData } from '@finance-app/shared';

function PieTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: { color: string } }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-popover-foreground text-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.payload.color }} />
        <span className="font-medium">{item.name}</span>
      </div>
      <p className="mt-0.5 font-semibold">{formatBRL(item.value)}</p>
    </div>
  );
}

interface CategoryPieChartProps {
  data?: CategoryData[];
  isLoading?: boolean;
}

export function CategoryPieChart({ data, isLoading }: CategoryPieChartProps) {
  const hasData = data && data.length > 0;
  const total = data?.reduce((s, d) => s + d.value, 0) ?? 0;

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="text-base">Gastos por Categoria</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <>
            <Skeleton className="mx-auto h-44 w-44 rounded-full" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          </>
        ) : !hasData ? (
          <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
            Nenhum gasto registrado este mês
          </div>
        ) : (
          <>
            {/* Donut chart */}
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<PieTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            {/* Category list */}
            <div className="space-y-2">
              {data.slice(0, 6).map((cat) => (
                <div key={cat.name} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="flex-1 truncate text-muted-foreground">{cat.name}</span>
                  <span className="font-medium">{formatBRL(cat.value)}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground">
                    {total > 0 ? formatPercent((cat.value / total) * 100, 0) : '0%'}
                  </span>
                </div>
              ))}
              {data.length > 6 && (
                <p className="text-xs text-muted-foreground">+{data.length - 6} categorias</p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
