import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../../config/prisma', () => ({ prisma: { transaction: { findMany: m.findMany } } }));

import { buildReport, reportSummary } from '../report';

// 2026-11-21 15:00 UTC = 12:00 BR
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 21, 15, 0, 0));
});
afterEach(() => vi.useRealTimers());

const tx = (type: 'INCOME' | 'EXPENSE', amount: number, cat: string | null = 'Casa') => ({
  type, amount, category: cat ? { name: cat, color: '#111111' } : null,
});
const whereOf = () => m.findMany.mock.calls[0][0].where;

describe('buildReport', () => {
  it('30d: janela de hoje-29 até hoje, somas e categorias agrupadas', async () => {
    m.findMany.mockResolvedValue([tx('EXPENSE', -70), tx('EXPENSE', -30, 'Comida'), tx('EXPENSE', -5), tx('INCOME', 100)]);
    const r = await buildReport(1, '30d');
    expect(r.label).toBe('últimos 30 dias');
    expect(whereOf().userId).toBe(1);
    expect(whereOf().date.gte.toISOString()).toBe('2026-10-23T00:00:00.000Z');
    expect(whereOf().date.lte.toISOString()).toBe('2026-11-21T00:00:00.000Z');
    expect(r.income).toBe(100);
    expect(r.expense).toBe(105);
    expect(r.slices.find((s) => s.name === 'Casa')?.value).toBe(75);
  });

  it('mes: do dia 1; rótulo é o nome do mês', async () => {
    m.findMany.mockResolvedValue([]);
    const r = await buildReport(1, 'mes');
    expect(r.label).toBe('novembro');
    expect(whereOf().date.gte.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('6m: do primeiro dia de 5 meses atrás', async () => {
    m.findMany.mockResolvedValue([]);
    await buildReport(1, '6m');
    expect(whereOf().date.gte.toISOString()).toBe('2026-06-01T00:00:00.000Z');
  });

  it('tudo: sem limite inferior; categoria nula vira "Sem categoria"', async () => {
    m.findMany.mockResolvedValue([tx('EXPENSE', -4, null)]);
    const r = await buildReport(1, 'tudo');
    expect(whereOf().date.gte).toBeUndefined();
    expect(r.slices).toEqual([{ name: 'Sem categoria', value: 4, color: '#6b7280' }]);
  });

  it('reportSummary traz receitas, despesas e resultado', async () => {
    m.findMany.mockResolvedValue([tx('INCOME', 100), tx('EXPENSE', -30)]);
    const txt = reportSummary(await buildReport(1, '30d'));
    expect(txt).toMatch(/Receitas: R\$ 100,00/);
    expect(txt).toMatch(/Despesas: R\$ 30,00/);
    expect(txt).toMatch(/Resultado: R\$ 70,00/);
  });
});
