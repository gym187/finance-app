'use client';

import { useState } from 'react';
import { Plus, TrendingDown, Wallet, Calendar, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useLoans, useLoanSummary, useLoanMutations } from '@/hooks/useLoans';
import type { Loan, LoanType } from '@/hooks/useLoans';
import { formatBRL } from '@/lib/formatters';
import { LoanModal } from '@/components/loans/LoanModal';
import { PayModal } from '@/components/loans/PayModal';
import { LoanDetailDrawer } from '@/components/loans/LoanDetailDrawer';
import { cn } from '@/lib/utils';

type Filter = 'ALL' | LoanType;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'ALL',         label: 'Todos' },
  { value: 'LOAN',        label: 'Empréstimos' },
  { value: 'CREDIT_CARD', label: 'Cartões' },
  { value: 'BOLETO',      label: 'Boletos' },
];

const TYPE_LABELS: Record<string, string> = {
  LOAN: 'Empréstimo',
  CREDIT_CARD: 'Cartão',
  BOLETO: 'Boleto',
};

function nextDueLabel(loan: Loan) {
  if (loan.dueDate) {
    return new Date(loan.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
  }
  const now = new Date();
  let due = new Date(now.getFullYear(), now.getMonth(), loan.dueDayOfMonth);
  if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, loan.dueDayOfMonth);
  return due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function progressPct(loan: Loan) {
  if (loan.isInstallmentDebt && loan.installments) {
    return (loan.paidInstallments / loan.installments) * 100;
  }
  if (loan.principalAmount <= 0) return 0;
  return Math.min(100, ((loan.principalAmount - loan.currentBalance) / loan.principalAmount) * 100);
}

function isOverdue(loan: Loan) {
  if (!loan.dueDate) return false;
  const dueDay = loan.dueDate.slice(0, 10);
  const todayDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  return dueDay < todayDay;
}

export default function LoansPage() {
  const { data: loans = [], isLoading } = useLoans();
  const { data: summary, isLoading: loadingSummary } = useLoanSummary();
  const { create, update, pay, remove } = useLoanMutations();

  const [filter, setFilter] = useState<Filter>('ALL');
  const [loanModal, setLoanModal] = useState<{ open: boolean; editing: Loan | null }>({ open: false, editing: null });
  const [payModal, setPayModal] = useState<{ open: boolean; loan: Loan | null }>({ open: false, loan: null });
  const [drawer, setDrawer] = useState<{ open: boolean; loan: Loan | null }>({ open: false, loan: null });

  const active = loans.filter((l) => l.isActive && (filter === 'ALL' || (l.type ?? 'LOAN') === filter));
  const inactive = loans.filter((l) => !l.isActive && (filter === 'ALL' || (l.type ?? 'LOAN') === filter));

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
    // Atualiza o drawer se estiver aberto para o mesmo loan
    if (drawer.loan?.id === payModal.loan.id) {
      setDrawer((prev) => ({ ...prev, loan: { ...prev.loan!, currentBalance: 0 } }));
    }
  };

  const handleDelete = async (loan: Loan) => {
    if (!confirm('Excluir este registro e todo o histórico?')) return;
    await remove.mutateAsync(loan.id);
    if (drawer.loan?.id === loan.id) setDrawer({ open: false, loan: null });
  };

  const openDrawer = (loan: Loan) => setDrawer({ open: true, loan });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Dívidas</h2>
          <p className="text-sm text-muted-foreground">Empréstimos, cartões e boletos</p>
        </div>
        <Button size="sm" onClick={() => setLoanModal({ open: true, editing: null })}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Dívida
        </Button>
      </div>

      {/* KPI bar */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex divide-x">
          {loadingSummary ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex-1 px-5 py-4 space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-6 w-32" />
              </div>
            ))
          ) : (
            <>
              <div className="flex-1 px-5 py-4">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  <TrendingDown className="h-3 w-3" />
                  Total em dívida
                </div>
                <p className="text-xl font-bold text-expense font-[family-name:var(--font-roboto-mono)]">
                  {formatBRL(summary?.totalDebt ?? 0)}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{summary?.activeCount ?? 0} ativo{(summary?.activeCount ?? 0) !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex-1 px-5 py-4">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  <Wallet className="h-3 w-3" />
                  Total já pago
                </div>
                <p className="text-xl font-bold text-income font-[family-name:var(--font-roboto-mono)]">
                  {formatBRL(summary?.totalPaid ?? 0)}
                </p>
              </div>
              <div className="flex-1 px-5 py-4">
                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  <Calendar className="h-3 w-3" />
                  Próximo vencimento
                </div>
                {summary?.nextDue[0] ? (
                  <>
                    <p className="text-xl font-bold font-[family-name:var(--font-roboto-mono)]">
                      {new Date(summary.nextDue[0].dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground truncate">{summary.nextDue[0].name}</p>
                  </>
                ) : (
                  <p className="text-xl font-bold text-muted-foreground">—</p>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Tabela */}
      <div className="rounded-xl border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-xs uppercase tracking-wide">Nome</TableHead>
              <TableHead className="hidden sm:table-cell text-xs uppercase tracking-wide">Tipo</TableHead>
              <TableHead className="hidden md:table-cell text-xs uppercase tracking-wide">Vencimento</TableHead>
              <TableHead className="hidden md:table-cell text-xs uppercase tracking-wide">Parcela</TableHead>
              <TableHead className="text-right text-xs uppercase tracking-wide">Saldo devedor</TableHead>
              <TableHead className="hidden lg:table-cell w-32 text-xs uppercase tracking-wide">Progresso</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : active.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                  Nenhuma dívida ativa
                </TableCell>
              </TableRow>
            ) : (
              active.map((loan) => {
                const overdue = isOverdue(loan);
                const pct = progressPct(loan);
                const interest = loan.currentBalance * (loan.interestRate / 100);
                const installment = loan.installmentAmount ?? (loan.currentBalance + interest);

                return (
                  <TableRow
                    key={loan.id}
                    className={cn('cursor-pointer hover:bg-muted/50', overdue && 'bg-destructive/5 hover:bg-destructive/10')}
                    onClick={() => openDrawer(loan)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{loan.name}</p>
                        {overdue && (
                          <p className="text-xs text-destructive">Vencida</p>
                        )}
                        {loan.isInstallmentDebt && loan.installments && (
                          <p className="text-xs text-muted-foreground">
                            Parcela {Math.min(loan.paidInstallments + 1, loan.installments)}/{loan.installments}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="text-xs">{TYPE_LABELS[loan.type ?? 'LOAN']}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                      {nextDueLabel(loan)}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm font-medium font-[family-name:var(--font-roboto-mono)]">
                      {formatBRL(installment)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm font-semibold text-expense font-[family-name:var(--font-roboto-mono)]">
                        {formatBRL(loan.currentBalance)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <div className="space-y-1">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-muted-foreground">{pct.toFixed(0)}%</p>
                      </div>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(loan)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Quitadas */}
      {inactive.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold text-muted-foreground">Quitadas ({inactive.length})</p>
          <div className="rounded-xl border overflow-x-auto opacity-60">
            <Table>
              <TableBody>
                {inactive.map((loan) => (
                  <TableRow key={loan.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDrawer(loan)}>
                    <TableCell className="font-medium text-sm">{loan.name}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Badge variant="secondary" className="text-xs">{TYPE_LABELS[loan.type ?? 'LOAN']}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      Total pago: {formatBRL(loan.totalPaid)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(loan)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
      <LoanDetailDrawer
        open={drawer.open}
        loan={drawer.loan}
        onClose={() => setDrawer({ open: false, loan: null })}
        onEdit={(loan) => { setDrawer({ open: false, loan: null }); setLoanModal({ open: true, editing: loan }); }}
        onDelete={handleDelete}
        onPay={(loan) => setPayModal({ open: true, loan })}
      />
    </div>
  );
}
