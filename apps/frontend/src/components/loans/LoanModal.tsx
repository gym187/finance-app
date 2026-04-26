'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCategories } from '@/hooks/useCategories';
import type { Loan, LoanType } from '@/hooks/useLoans';

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: unknown) => Promise<void>;
  editing?: Loan | null;
  isLoading?: boolean;
}

interface FormState {
  type: LoanType;
  name: string;
  principalAmount: string;
  interestRate: string;
  startDate: string;
  dueDayOfMonth: string;
  dueDate: string;
  closingDay: string;
  installments: string;
  categoryId: string;
  notes: string;
}

const today = new Date().toISOString().split('T')[0];

const empty: FormState = {
  type: 'LOAN',
  name: '',
  principalAmount: '',
  interestRate: '',
  startDate: today,
  dueDayOfMonth: String(new Date().getDate()),
  dueDate: today,
  closingDay: '',
  installments: '',
  categoryId: '',
  notes: '',
};

const TYPE_LABELS: Record<LoanType, string> = {
  LOAN: 'Empréstimo',
  CREDIT_CARD: 'Cartão de Crédito',
  BOLETO: 'Boleto',
};

export function LoanModal({ open, onClose, onSubmit, editing, isLoading }: Props) {
  const [form, setForm] = useState<FormState>(empty);
  const { data: categories = [] } = useCategories();

  useEffect(() => {
    if (editing) {
      setForm({
        type: editing.type ?? 'LOAN',
        name: editing.name,
        principalAmount: editing.principalAmount.toString(),
        interestRate: editing.interestRate.toString(),
        startDate: editing.startDate.split('T')[0],
        dueDayOfMonth: editing.dueDayOfMonth.toString(),
        dueDate: editing.dueDate ? editing.dueDate.split('T')[0] : today,
        closingDay: editing.closingDay?.toString() ?? '',
        installments: editing.installments?.toString() ?? '',
        categoryId: editing.categoryId?.toString() ?? '',
        notes: editing.notes ?? '',
      });
    } else {
      setForm(empty);
    }
  }, [editing, open]);

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const field = (key: keyof FormState) => ({
    value: form[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => set(key, e.target.value),
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      type: form.type,
      name: form.name.trim(),
      principalAmount: parseFloat(form.principalAmount),
    };

    if (form.type === 'BOLETO') {
      payload.dueDate = new Date(form.dueDate).toISOString();
    } else {
      payload.interestRate = parseFloat(form.interestRate) || 0;
      payload.dueDayOfMonth = parseInt(form.dueDayOfMonth, 10);
      if (form.type === 'LOAN') {
        payload.startDate = new Date(form.startDate).toISOString();
      }
      if (form.type === 'CREDIT_CARD' && form.closingDay.trim()) {
        payload.closingDay = parseInt(form.closingDay, 10);
      }
      if (form.installments.trim()) {
        payload.installments = parseInt(form.installments, 10);
      }
    }

    if (form.categoryId) payload.categoryId = parseInt(form.categoryId, 10);
    if (form.notes.trim()) payload.notes = form.notes.trim();
    await onSubmit(payload);
  };

  const title = editing
    ? `Editar ${TYPE_LABELS[form.type]}`
    : 'Nova Dívida';

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Seletor de tipo — só no cadastro */}
          {!editing && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Tipo *</label>
              <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
                {(['LOAN', 'CREDIT_CARD', 'BOLETO'] as LoanType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => set('type', t)}
                    className={`rounded-md py-1.5 text-xs font-medium transition-colors ${
                      form.type === t
                        ? 'bg-background shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Nome */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {form.type === 'CREDIT_CARD' ? 'Nome do cartão *' : 'Nome / Descrição *'}
            </label>
            <Input
              placeholder={
                form.type === 'BOLETO' ? 'Ex: Conta de luz' :
                form.type === 'CREDIT_CARD' ? 'Ex: Nubank, Itaú' :
                'Ex: Financiamento do carro'
              }
              {...field('name')}
              required
            />
          </div>

          {/* Valor */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              {form.type === 'CREDIT_CARD' ? 'Saldo devedor atual (R$) *' : 'Valor (R$) *'}
            </label>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0,00"
              {...field('principalAmount')}
              required
              disabled={!!editing && form.type !== 'BOLETO'}
            />
          </div>

          {/* BOLETO: data de vencimento exata */}
          {form.type === 'BOLETO' && (
            <div>
              <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Data de vencimento *</label>
              <Input type="date" {...field('dueDate')} required />
            </div>
          )}

          {/* LOAN / CREDIT_CARD: juros + vencimento */}
          {form.type !== 'BOLETO' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Juros (% a.m.) *</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    placeholder={form.type === 'CREDIT_CARD' ? '10,99' : '1,5'}
                    {...field('interestRate')}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    {form.type === 'CREDIT_CARD' ? 'Dia de pagamento *' : 'Dia de vencimento *'}
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    placeholder="10"
                    {...field('dueDayOfMonth')}
                    required
                  />
                </div>
              </div>

              {/* Cartão: dia de fechamento */}
              {form.type === 'CREDIT_CARD' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Dia de fechamento da fatura</label>
                  <Input
                    type="number"
                    min="1"
                    max="28"
                    placeholder="Opcional (ex: 15)"
                    {...field('closingDay')}
                  />
                </div>
              )}

              {/* Empréstimo: data de início */}
              {form.type === 'LOAN' && (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Data de início *</label>
                  <Input type="date" {...field('startDate')} required disabled={!!editing} />
                </div>
              )}

              {/* Parcelas */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                  {form.type === 'CREDIT_CARD' ? 'Parcelas do parcelamento (opcional)' : 'Número de parcelas (opcional)'}
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="Deixe vazio para aberto"
                  {...field('installments')}
                />
                {form.type === 'LOAN' && (
                  <p className="mt-1 text-xs text-muted-foreground">Se informado, calcula parcela pela tabela Price.</p>
                )}
              </div>
            </>
          )}

          {/* Categoria */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
              Categoria do pagamento *
            </label>
            <Select
              value={form.categoryId}
              onValueChange={(v) => set('categoryId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={String(cat.id)}>
                    <span className="flex items-center gap-2">
                      {cat.color && (
                        <span className="h-2 w-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                      )}
                      {cat.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">
              Usada ao registrar pagamentos no extrato
            </p>
          </div>

          {/* Observações */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Observações</label>
            <Input
              placeholder={
                form.type === 'BOLETO' ? 'Código de barras, empresa, etc.' :
                form.type === 'CREDIT_CARD' ? 'Bandeira, limite, etc.' :
                'Banco, contrato, etc.'
              }
              {...field('notes')}
            />
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
