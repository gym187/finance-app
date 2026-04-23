'use client';

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL, formatPercent } from '@/lib/formatters';
import type { AllocationEntry } from '@/hooks/useInvestments';

function AllocationTooltip({ active, payload }: { active?: boolean; payload?: { name: string; value: number; payload: AllocationEntry }[] }) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 shadow-lg text-popover-foreground text-sm">
      <div className="flex items-center gap-2">
        <span className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: item.payload.color }} />
        <span className="font-medium">{item.payload.label}</span>
      </div>
      <p className="mt-0.5 font-semibold">{formatBRL(item.value)}</p>
      <p className="text-xs opacity-70">{formatPercent(item.payload.percent, 1)}</p>
    </div>
  );
}

interface Props {
  allocation?: AllocationEntry[];
  isLoading?: boolean;
}

export function AllocationChart({ allocation, isLoading }: Props) {
  const hasData = allocation && allocation.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alocação por Classe</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {isLoading ? (
          <>
            <Skeleton className="mx-auto h-44 w-44 rounded-full" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          </>
        ) : !hasData ? (
          <div className="flex h-44 items-center justify-center text-sm text-muted-foreground">
            Nenhum investimento cadastrado
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={allocation}
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {allocation.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<AllocationTooltip />} />
              </PieChart>
            </ResponsiveContainer>

            <div className="space-y-2">
              {allocation.map((a) => (
                <div key={a.type} className="flex items-center gap-2 text-sm">
                  <span
                    className="h-2.5 w-2.5 flex-shrink-0 rounded-full"
                    style={{ backgroundColor: a.color }}
                  />
                  <span className="flex-1 truncate text-muted-foreground">{a.label}</span>
                  <span className="font-medium">{formatBRL(a.value)}</span>
                  <span className="w-10 text-right text-xs text-muted-foreground">
                    {formatPercent(a.percent, 0)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
