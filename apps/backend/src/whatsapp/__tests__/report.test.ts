import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const m = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock('../../config/prisma', () => ({ prisma: { transaction: { findMany: m.findMany } } }));

import { buildReport } from '../report';

// 2026-11-21 15:00 UTC = 12:00 BR
beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(Date.UTC(2026, 10, 21, 15, 0, 0));
});
afterEach(() => vi.useRealTimers());

const tx = (type: 'INCOME' | 'EXPENSE', amount: number, date: string, cat: string | null = 'Casa') => ({
  type, amount, date: new Date(`${date}T00:00:00Z`), category: cat ? { name: cat, color: '#111111' } : null,
});

describe('buildReport', () => {
  it('30d: 30 pontos diários com zeros nos dias vazios e somas por categoria', async () => {
    m.findMany.mockResolvedValue([
      tx('EXPENSE', -70, '2026-11-10'),
      tx('EXPENSE', -30, '2026-11-10', 'Comida'),
      tx('EXPENSE', -5, '2026-11-11'),
      tx('INCOME', 100, '2026-11-21'),
    ]);
    const r = await buildReport(1, '30d');
    expect(r.label).toBe('últimos 30 dias');
    expect(r.points).toHaveLength(30);
    expect(r.points[0].label).toBe('23/10');
    expect(r.points[29]).toMatchObject({ label: '21/11', income: 100, expense: 0 });
    expect(r.points.find((p) => p.label === '10/11')).toMatchObject({ expense: 100 });
    expect(r.income).toBe(100);
    expect(r.expense).toBe(105);
    expect(r.slices.find((s) => s.name === 'Casa')?.value).toBe(75);
  });

  it('mes: pontos do dia 1 até hoje; rótulo é o nome do mês', async () => {
    m.findMany.mockResolvedValue([]);
    const r = await buildReport(1, 'mes');
    expect(r.label).toBe('novembro');
    expect(r.points).toHaveLength(21);
  });

  it('6m: 6 pontos mensais', async () => {
    m.findMany.mockResolvedValue([tx('EXPENSE', -10, '2026-06-15')]);
    const r = await buildReport(1, '6m');
    expect(r.points.map((p) => p.label)).toEqual(['jun', 'jul', 'ago', 'set', 'out', 'nov']);
    expect(r.points[0].expense).toBe(10);
  });

  it('tudo: começa no mês do primeiro lançamento e põe o ano quando cruza anos', async () => {
    m.findMany.mockResolvedValue([tx('INCOME', 10, '2025-12-03'), tx('EXPENSE', -4, '2026-11-01', null)]);
    const r = await buildReport(1, 'tudo');
    expect(r.points).toHaveLength(12);
    expect(r.points[0].label).toBe('dez/25');
    expect(r.slices[0].name).toBe('Sem categoria');
    expect(m.findMany.mock.calls[0][0].where.date.gte).toBeUndefined();
  });

  it('tudo sem lançamentos: um ponto (mês atual) e sem fatias', async () => {
    m.findMany.mockResolvedValue([]);
    const r = await buildReport(1, 'tudo');
    expect(r.points).toHaveLength(1);
    expect(r.slices).toEqual([]);
  });
});
