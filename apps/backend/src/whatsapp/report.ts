import { prisma } from '../config/prisma';
import { nowBR } from '../config/date';
import { formatBRL } from './format';
import type { CategorySlice } from './charts';

export type Periodo = '30d' | 'mes' | '6m' | 'tudo';
export const PERIODOS: readonly Periodo[] = ['30d', 'mes', '6m', 'tudo'];
export const PERIODO_PADRAO: Periodo = '30d';

export type Report = {
  periodo: Periodo;
  /** Ex.: "últimos 30 dias", "novembro". */
  label: string;
  slices: CategorySlice[];
  income: number;
  expense: number;
};

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];

/** Datas são guardadas como meia-noite UTC do dia local; `nowBR()` já está no horário do Brasil. */
function utcDay(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

export async function buildReport(userId: number, periodo: Periodo): Promise<Report> {
  const now = nowBR();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = utcDay(y, m, now.getUTCDate());

  let from: Date | null;
  let label: string;
  switch (periodo) {
    case 'mes':
      from = utcDay(y, m, 1);
      label = MONTH_NAMES[m];
      break;
    case '6m':
      from = utcDay(y, m - 5, 1);
      label = 'últimos 6 meses';
      break;
    case 'tudo':
      from = null;
      label = 'todo o período';
      break;
    default:
      from = utcDay(y, m, now.getUTCDate() - 29);
      label = 'últimos 30 dias';
  }

  const txs = await prisma.transaction.findMany({
    where: { userId, ...(from ? { date: { gte: from, lte: today } } : { date: { lte: today } }) },
    select: { type: true, amount: true, category: { select: { name: true, color: true } } },
  });

  let income = 0;
  let expense = 0;
  const cats = new Map<string, CategorySlice>();

  for (const t of txs) {
    const value = Math.abs(Number(t.amount));
    if (t.type === 'INCOME') {
      income += value;
    } else {
      expense += value;
      const name = t.category?.name ?? 'Sem categoria';
      const cur = cats.get(name) ?? { name, value: 0, color: t.category?.color ?? '#6b7280' };
      cur.value += value;
      cats.set(name, cur);
    }
  }

  return { periodo, label, slices: [...cats.values()].filter((c) => c.value > 0), income, expense };
}

/** Resumo em texto do período (legenda das imagens e plano B quando o envio falha). */
export function reportSummary(r: Report): string {
  return [
    `*Resumo — ${r.label}*`,
    `🟢 Receitas: ${formatBRL(r.income)}`,
    `🔴 Despesas: ${formatBRL(r.expense)}`,
    `📊 Resultado: ${formatBRL(r.income - r.expense)}`,
  ].join('\n');
}
