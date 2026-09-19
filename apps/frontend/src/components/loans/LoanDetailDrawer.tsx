'use client';

import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useLoanPayments, useLoanSchedule } from '@/hooks/useLoans';
import type { Loan } from '@/hooks/useLoans';
import { formatBRL, formatTimestampBR } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const TYPE_LABELS: Record<string, string> = {
  LOAN: 'Empréstimo',
  CREDIT_CARD: 'Cartão',
  BOLETO: 'Boleto',
};

function progressPct(loan: Loan) {
  if (loan.isInstallmentDebt && loan.installments) {
    return (loan.paidInstallments / loan.installments) * 100;
  }
  if (loan.principalAmount <= 0) return 0;
  return Math.min(100, ((loan.principalAmount - loan.currentBalance) / loan.principalAmount) * 100);
}

function nextDueLabel(loan: Loan) {
  if (loan.dueDate) {
    return new Date(loan.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const now = new Date();
  let due = new Date(now.getFullYear(), now.getMonth(), loan.dueDayOfMonth);
  if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, loan.dueDayOfMonth);
  return due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function isOverdue(loan: Loan) {
  if (!loan.dueDate) return false;
  const dueDay = loan.dueDate.slice(0, 10);
  const todayDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return dueDay < todayDay;
}

interface Props {
  open: boolean;
  loan: Loan | null;
  onClose: () => void;
  onEdit: (loan: Loan) => void;
  onDelete: (loan: Loan) => void;
  onPay: (loan: Loan) => void;
}

export function LoanDetailDrawer({ open, loan, onClose, onEdit, onDelete, onPay }: Props) {
  const [tab, setTab] = useState<'history' | 'schedule'>('history');
  const { data: payments, isLoading: loadingPayments } = useLoanPayments(loan?.id ?? 0);
  const { data: schedule, isLoading: loadingSchedule } = useLoanSchedule(loan?.id ?? 0, open && tab === 'schedule');

  if (!loan) return null;

  const pct = progressPct(loan);
  const interest = loan.currentBalance * (loan.interestRate / 100);
  const installment = loan.installmentAmount ?? (loan.currentBalance + interest);
  const overdue = isOverdue(loan);
  const isBoleto = loan.type === 'BOLETO';
  const showSchedule = loan.type !== 'BOLETO';

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="flex w-full flex-col sm:max-w-lg overflow-hidden p-0">
        {/* Header */}
        <SheetHeader className="border-b px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate">{loan.name}</SheetTitle>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-xs">{TYPE_LABELS[loan.type]}</Badge>
                {overdue && <Badge variant="destructive" className="text-xs">Vencida</Badge>}
                {loan.type !== 'BOLETO' && (
                  <span className="text-xs text-muted-foreground">{loan.interestRate}% a.m.</span>
                )}
              </div>
            </div>
            <div className="flex flex-shrink-0 gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(loan)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(loan)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Saldo devedor</p>
              <p className="mt-1 text-sm font-bold text-expense font-[family-name:var(--font-roboto-mono)]">
                {formatBRL(loan.currentBalance)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {isBoleto ? 'Valor' : 'Próx. parcela'}
              </p>
              <p className="mt-1 text-sm font-bold font-[family-name:var(--font-roboto-mono)]">
                {formatBRL(installment)}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {isBoleto ? 'Vencimento' : 'Juros/mês'}
              </p>
              <p className={cn('mt-1 text-sm font-bold font-[family-name:var(--font-roboto-mono)]', !isBoleto && 'text-amber-500')}>
                {isBoleto ? nextDueLabel(loan) : formatBRL(interest)}
              </p>
            </div>
          </div>

          {/* Progress */}
          {(loan.isInstallmentDebt && loan.installments ? true : loan.type !== 'BOLETO') && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                {loan.isInstallmentDebt && loan.installments ? (
                  <>
                    <span>{loan.paidInstallments} de {loan.installments} parcelas pagas</span>
                    <span>{pct.toFixed(0)}%</span>
                  </>
                ) : (
                  <>
                    <span>Amortizado: {formatBRL(loan.principalAmount - loan.currentBalance)}</span>
                    <span>{pct.toFixed(1)}% do principal</span>
                  </>
                )}
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              {loan.type !== 'BOLETO' && (
                <p className="text-xs text-muted-foreground">
                  Total pago: {formatBRL(loan.totalPaid)} · Vence todo dia {loan.dueDayOfMonth} · Próximo: {nextDueLabel(loan)}
                </p>
              )}
            </div>
          )}

          {/* Pay button */}
          {loan.isActive && (
            <Button className="w-full" onClick={() => onPay(loan)}>
              {isBoleto && loan.isInstallmentDebt ? 'Pagar parcela' : isBoleto ? 'Pagar boleto' : 'Registrar pagamento'}
            </Button>
          )}

          {/* History / Schedule tabs */}
          <div>
            <div className="flex gap-1 rounded-lg bg-muted p-1 mb-4">
              <button
                onClick={() => setTab('history')}
                className={cn(
                  'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
                  tab === 'history' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                Histórico
              </button>
              {showSchedule && (
                <button
                  onClick={() => setTab('schedule')}
                  className={cn(
                    'flex-1 rounded-md py-1.5 text-xs font-medium transition-colors',
                    tab === 'schedule' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  Tabela Price
                </button>
              )}
            </div>

            {tab === 'history' && (
              loadingPayments ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                </div>
              ) : !payments?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Nenhum pagamento registrado</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p) => (
                    <div key={p.id} className="rounded-lg border p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={p.type === 'FULL' ? 'default' : 'secondary'} className="text-xs">
                            {p.type === 'FULL' ? 'Parcela' : 'Só juros'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">{formatTimestampBR(p.date)}</span>
                        </div>
                        <span className="font-semibold text-expense">-{formatBRL(p.amount)}</span>
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

            {tab === 'schedule' && showSchedule && (
              loadingSchedule ? (
                <div className="space-y-2">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
                </div>
              ) : !schedule?.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">Sem projeção disponível</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b text-muted-foreground">
                        <th className="p-2 text-left">#</th>
                        <th className="p-2 text-left">Vencto.</th>
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
                          <td className="p-2 text-right text-expense">{formatBRL(row.interest)}</td>
                          <td className="p-2 text-right text-income">{formatBRL(row.principal)}</td>
                          <td className="p-2 text-right">{formatBRL(row.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
