'use client';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Loan } from '@/hooks/useLoans';
import { formatBRL } from '@/lib/formatters';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (type: 'FULL' | 'INTEREST_ONLY') => Promise<void>;
  loan: Loan | null;
  isLoading?: boolean;
}

export function PayModal({ open, onClose, onSubmit, loan, isLoading }: Props) {
  if (!loan) return null;

  const balance = loan.currentBalance;
  const rate = loan.interestRate / 100;
  const interest = balance * rate;
  const installment = loan.installmentAmount ?? (balance + interest);
  const principalInInstallment = installment - interest;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Registrar Pagamento — {loan.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Saldo devedor</span>
              <span className="font-semibold">{formatBRL(balance)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Juros do período</span>
              <span className="font-semibold text-red-500">{formatBRL(interest)}</span>
            </div>
            {loan.installmentAmount && (
              <div className="flex justify-between border-t pt-1">
                <span className="text-muted-foreground">Parcela Price</span>
                <span className="font-semibold text-primary">{formatBRL(installment)}</span>
              </div>
            )}
          </div>

          <div className="grid gap-3">
            {/* Full payment */}
            <button
              onClick={() => onSubmit('FULL')}
              disabled={isLoading}
              className="flex flex-col rounded-lg border-2 border-primary bg-primary/5 p-4 text-left transition hover:bg-primary/10 disabled:opacity-50"
            >
              <span className="font-semibold text-primary">Pagamento Completo</span>
              <span className="mt-0.5 text-sm text-muted-foreground">
                Parcela: <strong className="text-foreground">{formatBRL(installment)}</strong>
                {' '}(juros {formatBRL(interest)} + principal {formatBRL(Math.max(0, principalInInstallment))})
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Saldo após: {formatBRL(Math.max(0, balance - principalInInstallment))}
              </span>
            </button>

            {/* Interest only */}
            <button
              onClick={() => onSubmit('INTEREST_ONLY')}
              disabled={isLoading}
              className="flex flex-col rounded-lg border p-4 text-left transition hover:bg-muted/50 disabled:opacity-50"
            >
              <span className="font-semibold">Somente Juros</span>
              <span className="mt-0.5 text-sm text-muted-foreground">
                Valor: <strong className="text-foreground">{formatBRL(interest)}</strong> — saldo não reduz
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Saldo após: {formatBRL(balance)} (sem amortização)
              </span>
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isLoading}>Cancelar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
