'use client';

import { useState } from 'react';
import { Plus, CreditCard, TrendingDown, Calendar, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useLoans, useLoanSummary, useLoanMutations } from '@/hooks/useLoans';
import type { Loan } from '@/hooks/useLoans';
import { formatBRL } from '@/lib/formatters';
import { LoanModal } from '@/components/loans/LoanModal';
import { PayModal } from '@/components/loans/PayModal';
import { LoanPaymentsDrawer } from '@/components/loans/LoanPaymentsDrawer';

function nextDueLabel(dueDayOfMonth: number): string {
  const now = new Date();
  let due = new Date(now.getFullYear(), now.getMonth(), dueDayOfMonth);
  if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, dueDayOfMonth);
  return due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function progressPct(loan: Loan): number {
  const total = loan.principalAmount;
  if (total <= 0) return 0;
  return Math.min(100, (loan.totalPaid / total) * 100);
}

export default function LoansPage() {
  const { data: loans = [], isLoading } = useLoans();
  const { data: summary, isLoading: loadingSummary } = useLoanSummary();
  const { create, update, pay, remove } = useLoanMutations();

  const [loanModal, setLoanModal] = useState<{ open: boolean; editing: Loan | null }>({ open: false, editing: null });
  const [payModal, setPayModal] = useState<{ open: boolean; loan: Loan | null }>({ open: false, loan: null });
  const [drawer, setDrawer] = useState<{ open: boolean; loan: Loan | null }>({ open: false, loan: null });

  const active = loans.filter((l) => l.isActive);
  const inactive = loans.filter((l) => !l.isActive);

  const handleSubmitLoan = async (data: unknown) => {
    if (loanModal.editing) {
      await update.mutateAsync({ id: loanModal.editing.id, data });
    } else {
      await create.mutateAsync(data);
    }
    setLoanModal({ open: false, editing: null });
  };

  const handlePay = async (type: 'FULL' | 'INTEREST_ONLY') => {
    if (!payModal.loan) return;
    await pay.mutateAsync({ id: payModal.loan.id, type });
    setPayModal({ open: false, loan: null });
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Excluir este empréstimo e todo o histórico?')) return;
    await remove.mutateAsync(id);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Empréstimos</h2>
          <p className="text-sm text-muted-foreground">Gerencie suas dívidas e financiamentos</p>
        </div>
        <Button size="sm" onClick={() => setLoanModal({ open: true, editing: null })}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Empréstimo
        </Button>
      </div>

      {/* Summary cards */}
      {loadingSummary ? (
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5"><Skeleton className="h-4 w-24 mb-2" /><Skeleton className="h-7 w-32" /></CardContent></Card>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <TrendingDown className="h-4 w-4" />
                Total em dívida
              </div>
              <p className="text-2xl font-bold text-red-500">{formatBRL(summary?.totalDebt ?? 0)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{summary?.activeCount ?? 0} empréstimos ativos</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <CreditCard className="h-4 w-4" />
                Total já pago
              </div>
              <p className="text-2xl font-bold text-green-600">{formatBRL(summary?.totalPaid ?? 0)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Calendar className="h-4 w-4" />
                Próximo vencimento
              </div>
              {summary?.nextDue[0] ? (
                <>
                  <p className="text-lg font-bold">{new Date(summary.nextDue[0].dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}</p>
                  <p className="text-xs text-muted-foreground truncate">{summary.nextDue[0].name}</p>
                </>
              ) : (
                <p className="text-lg font-bold text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active loans */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-full" /><Skeleton className="h-4 w-36" /></CardContent></Card>
          ))}
        </div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <CreditCard className="mx-auto h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">Nenhum empréstimo ativo</p>
            <p className="text-sm mt-1">Cadastre um empréstimo para acompanhar sua evolução</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {active.map((loan) => {
            const pct = progressPct(loan);
            const interest = loan.currentBalance * (loan.interestRate / 100);
            const installment = loan.installmentAmount ?? (loan.currentBalance + interest);

            return (
              <Card key={loan.id} className="overflow-hidden">
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{loan.name}</p>
                        <Badge variant="secondary" className="text-xs">{loan.interestRate}% a.m.</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Vence todo dia {loan.dueDayOfMonth} · Próximo: {nextDueLabel(loan.dueDayOfMonth)}
                      </p>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      <Button size="sm" className="h-7 px-2 text-xs" onClick={() => setPayModal({ open: true, loan })}>
                        Pagar parcela
                      </Button>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setDrawer({ open: true, loan })}>
                        <History className="h-3 w-3 mr-1" />
                        Histórico
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setLoanModal({ open: true, editing: loan })}>
                        Editar
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500" onClick={() => handleDelete(loan.id)}>
                        Excluir
                      </Button>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1 mb-3">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Pago: {formatBRL(loan.totalPaid)}</span>
                      <span>Total: {formatBRL(loan.principalAmount)}</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% quitado</p>
                  </div>

                  {/* Key numbers */}
                  <div className="grid grid-cols-3 gap-3 rounded-lg bg-muted/40 p-3 text-center text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Saldo atual</p>
                      <p className="font-semibold text-red-500">{formatBRL(loan.currentBalance)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Próx. parcela</p>
                      <p className="font-semibold">{formatBRL(installment)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Juros/mês</p>
                      <p className="font-semibold text-amber-600">{formatBRL(interest)}</p>
                    </div>
                  </div>

                  {loan.notes && (
                    <p className="mt-2 text-xs text-muted-foreground border-t pt-2">{loan.notes}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Inactive loans */}
      {inactive.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">Empréstimos quitados ({inactive.length})</h3>
          <div className="space-y-2">
            {inactive.map((loan) => (
              <Card key={loan.id} className="opacity-60">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{loan.name}</p>
                    <p className="text-xs text-muted-foreground">Total pago: {formatBRL(loan.totalPaid)}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant="secondary">Quitado</Badge>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDrawer({ open: true, loan })}>
                      <History className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500" onClick={() => handleDelete(loan.id)}>
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Modals */}
      <LoanModal
        open={loanModal.open}
        onClose={() => setLoanModal({ open: false, editing: null })}
        onSubmit={handleSubmitLoan}
        editing={loanModal.editing}
        isLoading={create.isPending || update.isPending}
      />
      <PayModal
        open={payModal.open}
        onClose={() => setPayModal({ open: false, loan: null })}
        onSubmit={handlePay}
        loan={payModal.loan}
        isLoading={pay.isPending}
      />
      {drawer.loan && (
        <LoanPaymentsDrawer
          open={drawer.open}
          onClose={() => setDrawer({ open: false, loan: null })}
          loanId={drawer.loan.id}
          loanName={drawer.loan.name}
        />
      )}
    </div>
  );
}
