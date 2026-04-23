'use client';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useLoanPayments, useLoanSchedule } from '@/hooks/useLoans';
import { formatBRL, formatDate } from '@/lib/formatters';
import { useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  loanId: number;
  loanName: string;
}

export function LoanPaymentsDrawer({ open, onClose, loanId, loanName }: Props) {
  const [tab, setTab] = useState<'history' | 'schedule'>('history');
  const { data: payments, isLoading: loadingPayments } = useLoanPayments(loanId);
  const { data: schedule, isLoading: loadingSchedule } = useLoanSchedule(loanId, tab === 'schedule');

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <div className="mb-4">
          <p className="text-lg font-semibold">{loanName}</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted p-1 mb-4">
          {(['history', 'schedule'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 rounded-md py-1.5 text-sm font-medium transition-colors ${tab === t ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'history' ? 'Histórico' : 'Tabela Price'}
            </button>
          ))}
        </div>

        {tab === 'history' && (
          loadingPayments ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : !payments?.length ? (
            <p className="text-center text-sm text-muted-foreground py-10">Nenhum pagamento registrado</p>
          ) : (
            <div className="space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={p.type === 'FULL' ? 'default' : 'secondary'} className="text-xs">
                        {p.type === 'FULL' ? 'Parcela' : 'Só juros'}
                      </Badge>
                      <span className="text-muted-foreground text-xs">{formatDate(p.date)}</span>
                    </div>
                    <span className="font-semibold text-red-500">-{formatBRL(p.amount)}</span>
                  </div>
                  <div className="flex gap-4 text-xs text-muted-foreground">
                    <span>Juros: {formatBRL(p.interestAmount)}</span>
                    <span>Principal: {formatBRL(p.principalAmount)}</span>
                    <span>Saldo: {formatBRL(p.balanceAfter)}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'schedule' && (
          loadingSchedule ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : !schedule?.length ? (
            <p className="text-center text-sm text-muted-foreground py-10">Sem projeção disponível</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-background">
                  <tr className="border-b text-muted-foreground">
                    <th className="p-2 text-left">#</th>
                    <th className="p-2 text-left">Vencimento</th>
                    <th className="p-2 text-right">Parcela</th>
                    <th className="p-2 text-right">Juros</th>
                    <th className="p-2 text-right">Principal</th>
                    <th className="p-2 text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row) => (
                    <tr key={row.period} className="border-b hover:bg-muted/30">
                      <td className="p-2 text-muted-foreground">{row.period}</td>
                      <td className="p-2">{row.date}</td>
                      <td className="p-2 text-right font-medium">{formatBRL(row.installment)}</td>
                      <td className="p-2 text-right text-red-500">{formatBRL(row.interest)}</td>
                      <td className="p-2 text-right text-green-600">{formatBRL(row.principal)}</td>
                      <td className="p-2 text-right">{formatBRL(row.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </SheetContent>
    </Sheet>
  );
}
