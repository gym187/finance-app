import { prisma } from '../config/prisma';
import { nowBR } from '../config/date';
import { formatBRL } from './format';
import type { CategorySlice, SeriesPoint } from './charts';

export type Periodo = '30d' | 'mes' | '6m' | 'tudo';
export const PERIODOS: readonly Periodo[] = ['30d', 'mes', '6m', 'tudo'];
export const PERIODO_PADRAO: Periodo = '30d';

export type Report = {
  periodo: Periodo;
  /** Ex.: "últimos 30 dias", "novembro". */
  label: string;
  slices: CategorySlice[];
  points: SeriesPoint[];
  income: number;
  expense: number;
};

const MONTH_NAMES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
];
const MONTH_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MAX_MONTHS = 120;

const pad = (n: number) => String(n).padStart(2, '0');

/** Datas são guardadas como meia-noite UTC do dia local; `nowBR()` já está no horário do Brasil. */
function utcDay(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m, d));
}

function monthKey(d: Date): string {
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
}

/** Mensal, com o ano quando a série cruza anos ("nov/26"). */
function monthLabel(key: string, withYear: boolean): string {
  const abbr = MONTH_ABBR[Number(key.slice(5, 7)) - 1] ?? key;
  return withYear ? `${abbr}/${key.slice(2, 4)}` : abbr;
}

export async function buildReport(userId: number, periodo: Periodo): Promise<Report> {
  const now = nowBR();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const today = utcDay(y, m, now.getUTCDate());

  let from: Date | null;
  let label: string;
  let daily: boolean;
  switch (periodo) {
    case 'mes':
      from = utcDay(y, m, 1);
      label = MONTH_NAMES[m];
      daily = true;
      break;
    case '6m':
      from = utcDay(y, m - 5, 1);
      label = 'últimos 6 meses';
      daily = false;
      break;
    case 'tudo':
      from = null;
      label = 'todo o período';
      daily = false;
      break;
    default:
      from = utcDay(y, m, now.getUTCDate() - 29);
      label = 'últimos 30 dias';
      daily = true;
  }

  const txs = await prisma.transaction.findMany({
    where: { userId, ...(from ? { date: { gte: from, lte: today } } : { date: { lte: today } }) },
    select: { type: true, amount: true, date: true, category: { select: { name: true, color: true } } },
    orderBy: { date: 'asc' },
  });

  let income = 0;
  let expense = 0;
  const cats = new Map<string, CategorySlice>();
  const buckets = new Map<string, { income: number; expense: number }>();

  // Esqueleto da série (zeros nos dias/meses sem lançamento).
  let start = from;
  if (!start) {
    const first = txs[0]?.date ?? today;
    start = utcDay(first.getUTCFullYear(), first.getUTCMonth(), 1);
    const minStart = utcDay(y, m - (MAX_MONTHS - 1), 1);
    if (start < minStart) start = minStart;
  }
  if (daily) {
    for (let d = new Date(start); d <= today; d = utcDay(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1)) {
      buckets.set(d.toISOString().slice(0, 10), { income: 0, expense: 0 });
    }
  } else {
    for (let d = new Date(start); d <= today; d = utcDay(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)) {
      buckets.set(monthKey(d), { income: 0, expense: 0 });
    }
  }

  for (const t of txs) {
    const value = Math.abs(Number(t.amount));
    const b = buckets.get(daily ? t.date.toISOString().slice(0, 10) : monthKey(t.date));
    if (t.type === 'INCOME') {
      income += value;
      if (b) b.income += value;
    } else {
      expense += value;
      if (b) b.expense += value;
      const name = t.category?.name ?? 'Sem categoria';
      const cur = cats.get(name) ?? { name, value: 0, color: t.category?.color ?? '#6b7280' };
      cur.value += value;
      cats.set(name, cur);
    }
  }

  const keys = [...buckets.keys()];
  const withYear = !daily && keys.length > 0 && keys[0].slice(0, 4) !== keys[keys.length - 1].slice(0, 4);
  const points = keys.map((k) => ({
    label: daily ? `${k.slice(8, 10)}/${k.slice(5, 7)}` : monthLabel(k, withYear),
    income: buckets.get(k)!.income,
    expense: buckets.get(k)!.expense,
  }));

  return { periodo, label, slices: [...cats.values()].filter((c) => c.value > 0), points, income, expense };
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
