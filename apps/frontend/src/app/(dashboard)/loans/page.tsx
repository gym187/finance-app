'use client';

import { useState } from 'react';
import { Plus, CreditCard, TrendingDown, Calendar, History, FileText, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useLoans, useLoanSummary, useLoanMutations } from '@/hooks/useLoans';
import type { Loan, LoanType } from '@/hooks/useLoans';
import { formatBRL } from '@/lib/formatters';
import { LoanModal } from '@/components/loans/LoanModal';
import { PayModal } from '@/components/loans/PayModal';
import { LoanPaymentsDrawer } from '@/components/loans/LoanPaymentsDrawer';

const TAB_CONFIG: { type: LoanType; label: string; icon: React.ReactNode; emptyText: string; emptyDesc: string }[] = [
  { type: 'LOAN',        label: 'Empréstimos',       icon: <Landmark className="h-4 w-4" />,  emptyText: 'Nenhum empréstimo ativo',       emptyDesc: 'Cadastre um empréstimo para acompanhar sua evolução' },
  { type: 'CREDIT_CARD', label: 'Cartões',            icon: <CreditCard className="h-4 w-4" />, emptyText: 'Nenhum cartão cadastrado',       emptyDesc: 'Cadastre uma fatura de cartão para controlar os juros' },
  { type: 'BOLETO',      label: 'Boletos',            icon: <FileText className="h-4 w-4" />,   emptyText: 'Nenhum boleto pendente',         emptyDesc: 'Cadastre boletos para não perder vencimentos' },
];

function nextDueLabel(loan: Loan): string {
  if (loan.dueDate) {
    return new Date(loan.dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' });
  }
  const now = new Date();
  let due = new Date(now.getFullYear(), now.getMonth(), loan.dueDayOfMonth);
  if (due <= now) due = new Date(now.getFullYear(), now.getMonth() + 1, loan.dueDayOfMonth);
  return due.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function progressPct(loan: Loan): number {
  if (loan.principalAmount <= 0) return 0;
  const principalPaid = loan.principalAmount - loan.currentBalance;
  return Math.min(100, Math.max(0, (principalPaid / loan.principalAmount) * 100));
}

function isOverdue(loan: Loan): boolean {
  if (!loan.dueDate) return false;
  return new Date(loan.dueDate) < new Date();
}

function LoanCard({ loan, onPay, onEdit, onDelete, onHistory }: {
  loan: Loan;
  onPay: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onHistory: () => void;
}) {
  const pct = progressPct(loan);
  const interest = loan.currentBalance * (loan.interestRate / 100);
  const installment = loan.installmentAmount ?? (loan.currentBalance + interest);
  const overdue = isOverdue(loan);

  return (
    <Card className={`overflow-hidden ${overdue ? 'border-red-300' : ''}`}>
      <CardContent className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold">{loan.name}</p>
              {loan.type === 'BOLETO' ? (
                overdue
                  ? <Badge variant="destructive" className="text-xs">Vencido</Badge>
                  : <Badge variant="outline" className="text-xs">Vence {nextDueLabel(loan)}</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs">{loan.interestRate}% a.m.</Badge>
              )}
              {loan.type === 'CREDIT_CARD' && loan.closingDay && (
                <Badge variant="outline" className="text-xs">Fecha dia {loan.closingDay}</Badge>
              )}
            </div>
            {loan.type !== 'BOLETO' && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Vence todo dia {loan.dueDayOfMonth} · Próximo: {nextDueLabel(loan)}
              </p>
            )}
          </div>
          <div className="flex gap-1 flex-wrap">
            <Button size="sm" className="h-7 px-2 text-xs" onClick={onPay}>
              {loan.type === 'BOLETO' ? 'Pagar' : 'Pagar parcela'}
            </Button>
            {loan.type !== 'BOLETO' && (
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={onHistory}>
                <History className="h-3 w-3 mr-1" />
                Histórico
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onEdit}>
              Editar
            </Button>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-red-500" onClick={onDelete}>
              Excluir
            </Button>
          </div>
        </div>

        {/* Boleto: só valor */}
        {loan.type === 'BOLETO' ? (
          <div className="rounded-lg bg-muted/40 p-3 text-center">
            <p className="text-xs text-muted-foreground mb-0.5">Valor</p>
            <p className="text-xl font-bold text-red-500">{formatBRL(loan.currentBalance)}</p>
          </div>
        ) : (
          <>
            {/* Barra de progresso */}
            <div className="space-y-1 mb-3">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Amortizado: {formatBRL(loan.principalAmount - loan.currentBalance)}</span>
                <span>Principal: {formatBRL(loan.principalAmount)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% do principal quitado</p>
            </div>

            {/* Números chave */}
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
          </>
        )}

        {loan.notes && (
          <p className="mt-2 text-xs text-muted-foreground border-t pt-2">{loan.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function LoansPage() {
  const { data: loans = [], isLoading } = useLoans();
  const { data: summary, isLoading: loadingSummary } = useLoanSummary();
  const { create, update, pay, remove } = useLoanMutations();

  const [activeTab, setActiveTab] = useState<LoanType>('LOAN');
  const [loanModal, setLoanModal] = useState<{ open: boolean; editing: Loan | null }>({ open: false, editing: null });
  const [payModal, setPayModal] = useState<{ open: boolean; loan: Loan | null }>({ open: false, loan: null });
  const [drawer, setDrawer] = useState<{ open: boolean; loan: Loan | null }>({ open: false, loan: null });

  const tabLoans = loans.filter((l) => (l.type ?? 'LOAN') === activeTab);
  const active = tabLoans.filter((l) => l.isActive);
  const inactive = tabLoans.filter((l) => !l.isActive);

  const counts = {
    LOAN: loans.filter((l) => (l.type ?? 'LOAN') === 'LOAN' && l.isActive).length,
    CREDIT_CARD: loans.filter((l) => l.type === 'CREDIT_CARD' && l.isActive).length,
    BOLETO: loans.filter((l) => l.type === 'BOLETO' && l.isActive).length,
  };

  const currentTab = TAB_CONFIG.find((t) => t.type === activeTab)!;

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
    if (!confirm('Excluir este registro e todo o histórico?')) return;
    await remove.mutateAsync(id);
  };

  return (
    <div className="space-y-5 sm:space-y-6">
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
              <p className="text-xs text-muted-foreground mt-0.5">{summary?.activeCount ?? 0} ativos</p>
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
                  <p className="text-lg font-bold">{new Date(summary.nextDue[0].dueDate).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' })}</p>
                  <p className="text-xs text-muted-foreground truncate">{summary.nextDue[0].name}</p>
                </>
              ) : (
                <p className="text-lg font-bold text-muted-foreground">—</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1">
        {TAB_CONFIG.map((tab) => (
          <button
            key={tab.type}
            onClick={() => setActiveTab(tab.type)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-2 text-xs sm:text-sm font-medium transition-colors ${
              activeTab === tab.type
                ? 'bg-background shadow-sm text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
            {counts[tab.type] > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-xs ${activeTab === tab.type ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20'}`}>
                {counts[tab.type]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Lista da aba ativa */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-48" /><Skeleton className="h-3 w-full" /><Skeleton className="h-4 w-36" /></CardContent></Card>
          ))}
        </div>
      ) : active.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <div className="mx-auto mb-3 opacity-30 flex justify-center">{currentTab.icon}</div>
            <p className="font-medium">{currentTab.emptyText}</p>
            <p className="text-sm mt-1">{currentTab.emptyDesc}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {active.map((loan) => (
            <LoanCard
              key={loan.id}
              loan={loan}
              onPay={() => setPayModal({ open: true, loan })}
              onEdit={() => setLoanModal({ open: true, editing: loan })}
              onDelete={() => handleDelete(loan.id)}
              onHistory={() => setDrawer({ open: true, loan })}
            />
          ))}
        </div>
      )}

      {/* Inativos/pagos */}
      {inactive.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            {activeTab === 'BOLETO' ? 'Boletos pagos' : activeTab === 'CREDIT_CARD' ? 'Faturas quitadas' : 'Empréstimos quitados'} ({inactive.length})
          </h3>
          <div className="space-y-2">
            {inactive.map((loan) => (
              <Card key={loan.id} className="opacity-60">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{loan.name}</p>
                    <p className="text-xs text-muted-foreground">Total pago: {formatBRL(loan.totalPaid)}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant="secondary">Pago</Badge>
                    {loan.type !== 'BOLETO' && (
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setDrawer({ open: true, loan })}>
                        <History className="h-3 w-3" />
                      </Button>
                    )}
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
