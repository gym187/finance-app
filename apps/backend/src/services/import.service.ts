import { prisma } from '../config/prisma';

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function detectSeparator(line: string): string {
  const semicolons = (line.match(/;/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  return semicolons >= commas ? ';' : ',';
}

function parseCsvLine(line: string, sep: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === sep && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function normalizeAmount(raw: string): number {
  // Handle Brazilian format: 1.234,56 → 1234.56
  let s = raw.replace(/[^\d,.-]/g, '');
  if (s.includes(',') && s.includes('.')) {
    // 1.234,56 format
    s = s.replace(/\./g, '').replace(',', '.');
  } else if (s.includes(',')) {
    s = s.replace(',', '.');
  }
  return parseFloat(s) || 0;
}

function parseDate(raw: string): Date | null {
  const clean = raw.trim();
  // dd/mm/yyyy or dd-mm-yyyy
  const dmy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (dmy) {
    const year = dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3];
    return new Date(`${year}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`);
  }
  // yyyy-mm-dd
  const ymd = clean.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (ymd) {
    return new Date(`${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`);
  }
  const d = new Date(clean);
  return isNaN(d.getTime()) ? null : d;
}

type ColMap = { date: number; description: number; amount: number; type: number | null };

function detectColumns(headers: string[]): ColMap | null {
  const h = headers.map((h) => h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''));
  const find = (...terms: string[]) => h.findIndex((col) => terms.some((t) => col.includes(t)));

  const date = find('data', 'date', 'dt', 'vencimento');
  const description = find('descri', 'historico', 'memo', 'lancamento', 'lançamento', 'detalhe', 'estabelecimento');
  const amount = find('valor', 'value', 'amount', 'vlr', 'montante');
  const type = find('tipo', 'type', 'natureza', 'operacao');

  if (date === -1 || description === -1 || amount === -1) return null;
  return { date, description, amount, type: type === -1 ? null : type };
}

// ─── Auto-categorization ─────────────────────────────────────────────────────

function autoCategory(description: string, categories: { id: number; name: string }[]): number | null {
  const desc = description.toLowerCase();
  for (const cat of categories) {
    if (desc.includes(cat.name.toLowerCase())) return cat.id;
  }
  return null;
}

// ─── Duplicate detection ──────────────────────────────────────────────────────

function makeKey(date: Date, amount: number, description: string): string {
  return `${date.toISOString().split('T')[0]}|${Math.abs(amount).toFixed(2)}|${description.trim().toLowerCase()}`;
}

// ─── Main service ─────────────────────────────────────────────────────────────

export interface ParsedRow {
  index: number;
  date: string;       // ISO date string
  description: string;
  amount: number;     // always positive
  type: 'INCOME' | 'EXPENSE';
  suggestedCategoryId: number | null;
  isDuplicate: boolean;
  error?: string;
}

export const importService = {
  async parseCSV(userId: number, csvText: string): Promise<{ rows: ParsedRow[]; headers: string[] }> {
    const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) throw new Error('Arquivo CSV vazio ou inválido');

    const sep = detectSeparator(lines[0]);
    const rawHeaders = parseCsvLine(lines[0], sep);
    const colMap = detectColumns(rawHeaders);

    // Fallback: positional (date, description, amount) if headers not recognized
    const cols: ColMap = colMap ?? { date: 0, description: 1, amount: 2, type: null };

    // Load user categories and existing transactions for duplicate check
    const [categories, existingTxs] = await Promise.all([
      prisma.category.findMany({ where: { userId }, select: { id: true, name: true } }),
      prisma.transaction.findMany({
        where: { userId },
        select: { date: true, amount: true, description: true },
      }),
    ]);

    const existingKeys = new Set(
      existingTxs.map((t) => makeKey(t.date, Number(t.amount), t.description))
    );

    const rows: ParsedRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cells = parseCsvLine(lines[i], sep);
      if (cells.every((c) => !c)) continue;

      const rawDate = cells[cols.date] ?? '';
      const rawDesc = cells[cols.description] ?? '';
      const rawAmount = cells[cols.amount] ?? '';
      const rawType = cols.type !== null ? (cells[cols.type] ?? '') : '';

      const date = parseDate(rawDate);
      if (!date || isNaN(date.getTime())) {
        rows.push({ index: i, date: '', description: rawDesc, amount: 0, type: 'EXPENSE', suggestedCategoryId: null, isDuplicate: false, error: `Data inválida: "${rawDate}"` });
        continue;
      }

      const amount = normalizeAmount(rawAmount);
      if (amount === 0) {
        rows.push({ index: i, date: date.toISOString(), description: rawDesc, amount: 0, type: 'EXPENSE', suggestedCategoryId: null, isDuplicate: false, error: `Valor inválido: "${rawAmount}"` });
        continue;
      }

      // Determine type: explicit column > amount sign
      let type: 'INCOME' | 'EXPENSE';
      const typeHint = rawType.toLowerCase();
      if (typeHint.includes('receita') || typeHint.includes('credito') || typeHint.includes('crédito') || typeHint.includes('entrada') || typeHint.includes('income') || typeHint === 'c') {
        type = 'INCOME';
      } else if (typeHint.includes('despesa') || typeHint.includes('debito') || typeHint.includes('débito') || typeHint.includes('saida') || typeHint.includes('saída') || typeHint === 'd') {
        type = 'EXPENSE';
      } else {
        type = amount >= 0 ? 'INCOME' : 'EXPENSE';
      }

      const absAmount = Math.abs(amount);
      const key = makeKey(date, absAmount, rawDesc);

      rows.push({
        index: i,
        date: date.toISOString(),
        description: rawDesc.trim(),
        amount: absAmount,
        type,
        suggestedCategoryId: autoCategory(rawDesc, categories),
        isDuplicate: existingKeys.has(key),
      });
    }

    return { rows, headers: rawHeaders };
  },

  async confirmImport(userId: number, rows: {
    date: string;
    description: string;
    amount: number;
    type: 'INCOME' | 'EXPENSE';
    categoryId: number;
  }[]) {
    const created = await prisma.$transaction(
      rows.map((r) =>
        prisma.transaction.create({
          data: {
            userId,
            description: r.description,
            amount: r.type === 'EXPENSE' ? -Math.abs(r.amount) : Math.abs(r.amount),
            type: r.type,
            categoryId: r.categoryId,
            date: new Date(r.date),
          },
        })
      )
    );
    return { imported: created.length };
  },
};
