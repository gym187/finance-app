'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { Loan } from '@/hooks/useLoans';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: unknown) => Promise<void>;
  editing?: Loan | null;
  isLoading?: boolean;
}

interface FormState {
  name: string;
  principalAmount: string;
  interestRate: string;
  startDate: string;
  dueDayOfMonth: string;
  installments: string;
  notes: string;
}

const empty: FormState = {
  name: '',
  principalAmount: '',
  interestRate: '',
  startDate: new Date().toISOString().split('T')[0],
  dueDayOfMonth: String(new Date().getDate()),
  installments: '',
  notes: '',
};

export function LoanModal({ open, onClose, onSubmit, editing, isLoading }: Props) {
  const [form, setForm] = useState<FormState>(empty);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        principalAmount: editing.principalAmount.toString(),
        interestRate: editing.interestRate.toString(),
        startDate: editing.startDate.split('T')[0],
        dueDayOfMonth: editing.dueDayOfMonth.toString(),
        installments: editing.installments?.toString() ?? '',
        notes: editing.notes ?? '',
      });
    } else {
      setForm(empty);
    }
  }, [editing, open]);

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      principalAmount: parseFloat(form.principalAmount),
      interestRate: parseFloat(form.interestRate),
      startDate: new Date(form.startDate).toISOString(),
      dueDayOfMonth: parseInt(form.dueDayOfMonth, 10),
    };
    if (form.installments.trim()) payload.installments = parseInt(form.installments, 10);
    if (form.notes.trim()) payload.notes = form.notes.trim();
    await onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Empréstimo' : 'Novo Empréstimo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome / Descrição *</label>
            <Input placeholder="Ex: Financiamento do carro" {...field('name')} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Valor Total (R$) *</label>
              <Input type="number" step="0.01" min="0.01" placeholder="10000,00" {...field('principalAmount')} required disabled={!!editing} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Juros (% a.m.) *</label>
              <Input type="number" step="0.01" min="0" max="100" placeholder="1,5" {...field('interestRate')} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Data de início *</label>
              <Input type="date" {...field('startDate')} required disabled={!!editing} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Dia de vencimento *</label>
              <Input type="number" min="1" max="28" placeholder="10" {...field('dueDayOfMonth')} required />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Número de parcelas (opcional)</label>
            <Input type="number" min="1" placeholder="Deixe vazio para aberto" {...field('installments')} />
            <p className="mt-1 text-xs text-muted-foreground">Se informado, calcula parcela pelo sistema Price (tabela francesa).</p>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Observações</label>
            <Input placeholder="Banco, contrato, etc." {...field('notes')} />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : editing ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
