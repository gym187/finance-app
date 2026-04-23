'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { SavingsGoal } from '@/hooks/useGoals';

const GOAL_COLORS = [
  { value: '#3b82f6', label: 'Azul' },
  { value: '#10b981', label: 'Verde' },
  { value: '#8b5cf6', label: 'Roxo' },
  { value: '#f59e0b', label: 'Amarelo' },
  { value: '#ef4444', label: 'Vermelho' },
  { value: '#06b6d4', label: 'Ciano' },
  { value: '#f97316', label: 'Laranja' },
  { value: '#ec4899', label: 'Rosa' },
];

const GOAL_ICONS = ['🏠', '🚗', '✈️', '💍', '📱', '🎓', '🏖️', '💊', '🛒', '🎯', '💰', '🌱'];

interface FormState {
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string;
  color: string;
  icon: string;
}

const emptyForm: FormState = {
  name: '',
  targetAmount: '',
  currentAmount: '',
  deadline: '',
  color: '#3b82f6',
  icon: '',
};

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: unknown) => Promise<void>;
  editing?: SavingsGoal | null;
  isLoading?: boolean;
}

export function GoalModal({ open, onClose, onSubmit, editing, isLoading }: Props) {
  const [form, setForm] = useState<FormState>(emptyForm);

  useEffect(() => {
    if (editing) {
      setForm({
        name: editing.name,
        targetAmount: editing.targetAmount.toString(),
        currentAmount: editing.currentAmount.toString(),
        deadline: editing.deadline ? editing.deadline.slice(0, 10) : '',
        color: editing.color ?? '#3b82f6',
        icon: editing.icon ?? '',
      });
    } else {
      setForm(emptyForm);
    }
  }, [editing, open]);

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value })),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      targetAmount: parseFloat(form.targetAmount),
      color: form.color,
    };
    if (form.currentAmount.trim()) payload.currentAmount = parseFloat(form.currentAmount);
    if (form.deadline.trim()) payload.deadline = new Date(form.deadline).toISOString();
    if (form.icon.trim()) payload.icon = form.icon.trim();
    await onSubmit(payload);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Editar Meta' : 'Nova Meta de Poupança'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Nome da meta *</label>
            <Input placeholder="Ex: Viagem para Europa" {...field('name')} required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Valor alvo (R$) *</label>
              <Input type="number" step="0.01" min="0.01" placeholder="10000,00" {...field('targetAmount')} required />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Já poupado (R$)</label>
              <Input type="number" step="0.01" min="0" placeholder="0,00" {...field('currentAmount')} />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Prazo (opcional)</label>
            <Input type="date" {...field('deadline')} />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Ícone (opcional)</label>
            <div className="flex flex-wrap gap-2 mt-1">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, icon: '' }))}
                className={`rounded border px-2 py-1 text-sm ${!form.icon ? 'border-primary bg-primary/10' : 'border-border'}`}
              >
                Nenhum
              </button>
              {GOAL_ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, icon }))}
                  className={`rounded border px-2 py-1 text-lg ${form.icon === icon ? 'border-primary bg-primary/10' : 'border-border'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Cor</label>
            <div className="flex gap-2 mt-1 flex-wrap">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, color: c.value }))}
                  className={`h-7 w-7 rounded-full border-2 transition-transform ${form.color === c.value ? 'scale-110 border-foreground' : 'border-transparent'}`}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : editing ? 'Salvar' : 'Criar Meta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
