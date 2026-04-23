'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SavingsGoal } from '@/hooks/useGoals';
import { formatBRL } from '@/lib/formatters';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => Promise<void>;
  goal: SavingsGoal | null;
  isLoading?: boolean;
}

export function ContributeModal({ open, onClose, onSubmit, goal, isLoading }: Props) {
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (open) setAmount('');
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || value <= 0) return;
    await onSubmit(value);
  };

  if (!goal) return null;

  const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Aportar em "{goal.name}"</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Poupado</span>
              <span className="font-medium">{formatBRL(goal.currentAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Meta</span>
              <span className="font-medium">{formatBRL(goal.targetAmount)}</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-muted-foreground">Faltam</span>
              <span className="font-semibold text-primary">{formatBRL(remaining)}</span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Valor do aporte (R$) *
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
              autoFocus
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Confirmar Aporte'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
