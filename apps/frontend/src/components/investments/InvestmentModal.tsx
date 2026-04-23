'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { InvestmentHolding } from '@/hooks/useInvestments';

const INVESTMENT_TYPES = [
  { value: 'STOCK', label: 'Ações' },
  { value: 'FII', label: 'Fundos Imobiliários (FII)' },
  { value: 'ETF', label: 'ETF' },
  { value: 'CRYPTO', label: 'Criptomoedas' },
  { value: 'FIXED_INCOME', label: 'Renda Fixa' },
  { value: 'OTHER', label: 'Outros' },
];

interface FormState {
  name: string;
  ticker: string;
  type: string;
  quantity: string;
  averagePrice: string;
  currentPrice: string;
  targetPercent: string;
  notes: string;
}

const emptyForm: FormState = {
  name: '',
  ticker: '',
  type: 'STOCK',
  quantity: '',
  averagePrice: '',
  currentPrice: '',
  targetPercent: '',
  notes: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: unknown) => Promise<void>;
  editing?: InvestmentHolding | null;
  isLoading?: boolean;
}

export function InvestmentModal({ open, onClose, onSubmit, editing, isLoading }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        ticker: editing.ticker ?? '',
        type: editing.type,
        quantity: editing.quantity.toString(),
        averagePrice: editing.averagePrice.toString(),
        currentPrice: editing.currentPrice !== editing.averagePrice ? editing.currentPrice.toString() : '',
        targetPercent: editing.targetPercent?.toString() ?? '',
        notes: editing.notes ?? '',
      });
    } else {
      setForm(emptyForm);
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
      type: form.type,
      quantity: parseFloat(form.quantity),
      averagePrice: parseFloat(form.averagePrice),
    };
    if (form.ticker.trim()) payload.ticker = form.ticker.trim().toUpperCase();
    if (form.currentPrice.trim()) payload.currentPrice = parseFloat(form.currentPrice);
    if (form.targetPercent.trim()) payload.targetPercent = parseFloat(form.targetPercent);
    if (form.notes.trim()) payload.notes = form.notes.trim();
    await onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Ativo' : 'Novo Ativo'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Nome do ativo *
              </label>
              <Input placeholder="Ex: Tesouro Selic 2029" {...field('name')} required />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Ticker / Código
              </label>
              <Input placeholder="Ex: PETR4" {...field('ticker')} />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Tipo *
              </label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INVESTMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Quantidade *
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="0"
                {...field('quantity')}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Preço Médio (R$) *
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="0,00"
                {...field('averagePrice')}
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Preço Atual (R$)
              </label>
              <Input
                type="number"
                step="any"
                min="0"
                placeholder="Deixe vazio = preço médio"
                {...field('currentPrice')}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Meta de Alocação (%)
              </label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="Ex: 20"
                {...field('targetPercent')}
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                Observações
              </label>
              <Input placeholder="Notas sobre este ativo..." {...field('notes')} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
