'use client';

import { Pencil, Trash2, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { formatBRL, formatPercent } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { InvestmentHolding } from '@/hooks/useInvestments';

const TYPE_COLORS: Record<string, string> = {
  STOCK: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  FII: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  ETF: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  CRYPTO: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  FIXED_INCOME: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  OTHER: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
};

interface Props {
  holdings?: InvestmentHolding[];
  isLoading?: boolean;
  onEdit?: (holding: InvestmentHolding) => void;
  onDelete?: (id: number) => void;
}

export function HoldingsTable({ holdings, isLoading, onEdit, onDelete }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Carteira de Ativos</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        ) : !holdings || holdings.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <TrendingUp className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Nenhum ativo cadastrado</p>
            <p className="text-xs text-muted-foreground">Clique em "Novo Ativo" para começar</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Ativo
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Qtd / P. Médio
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Valor Atual
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Rendimento
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    % Carteira
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {holdings.map((h) => (
                  <tr key={h.id} className="transition-colors hover:bg-muted/30">
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{h.name}</span>
                        <div className="flex items-center gap-1.5">
                          {h.ticker && (
                            <span className="font-mono text-xs font-semibold text-muted-foreground">
                              {h.ticker}
                            </span>
                          )}
                          <span
                            className={cn(
                              'rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                              TYPE_COLORS[h.type] ?? TYPE_COLORS.OTHER
                            )}
                          >
                            {h.typeLabel}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-medium">{h.quantity.toLocaleString('pt-BR')}</span>
                        <span className="text-xs text-muted-foreground">
                          @ {formatBRL(h.averagePrice)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-medium">{formatBRL(h.currentValue)}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatBRL(h.currentPrice)}/un
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={cn(
                            'flex items-center gap-1 font-semibold',
                            h.returnAbs >= 0 ? 'text-green-600' : 'text-red-500'
                          )}
                        >
                          {h.returnAbs >= 0 ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : (
                            <TrendingDown className="h-3 w-3" />
                          )}
                          {h.returnAbs >= 0 ? '+' : ''}
                          {formatBRL(h.returnAbs)}
                        </span>
                        <span
                          className={cn(
                            'text-xs font-medium',
                            h.returnPct >= 0 ? 'text-green-600' : 'text-red-500'
                          )}
                        >
                          {h.returnPct >= 0 ? '+' : ''}
                          {formatPercent(h.returnPct)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-medium">{formatPercent(h.currentPercent)}</span>
                        {h.targetPercent !== null && (
                          <span className="text-xs text-muted-foreground">
                            meta: {formatPercent(h.targetPercent)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => onEdit?.(h)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => onDelete?.(h.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
