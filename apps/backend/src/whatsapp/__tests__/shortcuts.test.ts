import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => ({
  getData: vi.fn(),
  findAllTx: vi.fn(),
  findAllBudget: vi.fn(),
  summary: vi.fn(),
}));
vi.mock('../../services/dashboard.service', () => ({ dashboardService: { getData: m.getData } }));
vi.mock('../../services/transaction.service', () => ({ transactionService: { findAll: m.findAllTx } }));
vi.mock('../../services/budget.service', () => ({ budgetService: { findAll: m.findAllBudget } }));
vi.mock('../../services/loan.service', () => ({ loanService: { summary: m.summary } }));

import { formatBRL, normalizeText } from '../format';
import { matchShortcut, runShortcut } from '../shortcuts';

beforeEach(() => vi.resetAllMocks());

describe('formatBRL / normalizeText', () => {
  it('formata BRL', () => {
    expect(formatBRL(1234.5)).toBe('R$ 1.234,50');
    expect(formatBRL(0)).toBe('R$ 0,00');
  });
  it('normaliza', () => {
    expect(normalizeText('  Últimas!!  ')).toBe('ultimas');
    expect(normalizeText('Não,   sim?')).toBe('nao sim');
  });
});

describe('matchShortcut', () => {
  it('casa exato após normalizar', () => {
    expect(matchShortcut('Saldo?', false)).toBe('saldo');
    expect(matchShortcut('extrato', false)).toBe('ultimas');
    expect(matchShortcut('Últimas', false)).toBe('ultimas');
    expect(matchShortcut('orçamentos', false)).toBe('orcamentos');
    expect(matchShortcut('dívidas', false)).toBe('dividas');
    expect(matchShortcut('ajuda', false)).toBe('ajuda');
    expect(matchShortcut('sair', false)).toBe('sair');
  });
  it('sim/nao só com pendência', () => {
    expect(matchShortcut('sim', false)).toBeNull();
    expect(matchShortcut('não', false)).toBeNull();
    expect(matchShortcut('sim', true)).toBe('sim');
    expect(matchShortcut('Não', true)).toBe('nao');
    expect(matchShortcut('s', true)).toBeNull();
    expect(matchShortcut('n', true)).toBeNull();
  });
  it('frases livres não casam', () => {
    expect(matchShortcut('quanto gastei com comida', false)).toBeNull();
    expect(matchShortcut('saldo do mes', false)).toBeNull();
  });
});

describe('runShortcut', () => {
  it('saldo', async () => {
    m.getData.mockResolvedValue({ balance: 1234.5 });
    expect(await runShortcut(1, 'saldo')).toContain('R$ 1.234,50');
  });
  it('resumo', async () => {
    m.getData.mockResolvedValue({ balance: 500, totalIncome: 2000, totalExpense: 1500 });
    const r = await runShortcut(1, 'resumo');
    expect(r).toContain('Receitas: R$ 2.000,00');
    expect(r).toContain('Despesas: R$ 1.500,00');
    expect(r).toContain('Saldo: R$ 500,00');
  });
  it('ultimas mostra magnitude com marcador', async () => {
    m.findAllTx.mockResolvedValue({
      data: [
        { type: 'EXPENSE', amount: -47, description: 'Mercado', date: new Date('2026-11-20T15:00:00Z'), category: { name: 'Comida' } },
        { type: 'INCOME', amount: 100, description: 'Pix', date: new Date('2026-11-19T15:00:00Z'), category: null },
      ],
    });
    const r = await runShortcut(1, 'ultimas');
    expect(m.findAllTx).toHaveBeenCalledWith(1, { page: 1, limit: 5 });
    expect(r).toContain('🔴 20/11 Mercado — R$ 47,00 (Comida)');
    expect(r).toContain('🟢 19/11 Pix — R$ 100,00');
  });
  it('ultimas vazio', async () => {
    m.findAllTx.mockResolvedValue({ data: [] });
    expect(await runShortcut(1, 'ultimas')).toBe('Você ainda não tem lançamentos.');
  });
  it('orcamentos', async () => {
    m.findAllBudget.mockResolvedValue([{ id: 1 }]);
    m.getData.mockResolvedValue({
      budgetSummary: [{ categoryName: 'Comida', budgeted: 1000, spent: 850.5, percentage: 85.05, type: 'EXPENSE' }],
    });
    expect(await runShortcut(1, 'orcamentos')).toContain('Comida: R$ 850,50 / R$ 1.000,00 (85%)');
  });
  it('orcamentos vazio', async () => {
    m.findAllBudget.mockResolvedValue([]);
    expect(await runShortcut(1, 'orcamentos')).toBe('Você ainda não tem orçamentos.');
  });
  it('dividas', async () => {
    m.summary.mockResolvedValue({
      totalDebt: 5000,
      totalPaid: 0,
      activeCount: 1,
      nextDue: [{ name: 'Carro', dueDate: '2026-12-05T12:00:00.000Z', installmentAmount: 800, currentBalance: 5000 }],
    });
    const r = await runShortcut(1, 'dividas');
    expect(r).toContain('Total devido: R$ 5.000,00');
    expect(r).toContain('Carro: vence 05/12 — R$ 800,00');
  });
  it('dividas vazio', async () => {
    m.summary.mockResolvedValue({ totalDebt: 0, totalPaid: 0, activeCount: 0, nextDue: [] });
    expect(await runShortcut(1, 'dividas')).toBe('Você não tem dívidas ativas. 🎉');
  });
  it('ajuda', async () => {
    const r = await runShortcut(1, 'ajuda');
    expect(r).toContain('gastei 47 no mercado');
    expect(r).toContain('sair');
  });
});
