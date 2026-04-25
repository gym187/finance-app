'use client';

import Link from 'next/link';
import { Target, Plus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatBRL } from '@/lib/formatters';

interface GoalItem {
  id: number;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline: string | null;
  color: string;
  icon: string | null;
  percent: number;
}

interface GoalsWidgetProps {
  goals?: GoalItem[];
  isLoading?: boolean;
}

export function GoalsWidget({ goals, isLoading }: GoalsWidgetProps) {
  if (!isLoading && (!goals || goals.length === 0)) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Target className="h-4 w-4 text-primary" />
            Metas de Poupança
          </CardTitle>
          <div className="flex items-center gap-2">
            <Link href="/goals" className="text-xs text-muted-foreground hover:text-primary">
              <Plus className="h-3.5 w-3.5" />
            </Link>
            <Link href="/goals" className="text-xs text-primary hover:underline">
              Ver todas
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-2 w-full" />
            </div>
          ))
        ) : (
          (goals ?? []).map((goal) => (
            <div key={goal.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-1.5 font-medium">
                  {goal.icon && <span>{goal.icon}</span>}
                  <span className="truncate max-w-[140px]">{goal.name}</span>
                </span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatBRL(goal.currentAmount)} / {formatBRL(goal.targetAmount)}
                </span>
              </div>
              <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${goal.percent}%`, backgroundColor: goal.color }}
                />
              </div>
              <p className="text-xs text-muted-foreground text-right">{goal.percent.toFixed(0)}%</p>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
