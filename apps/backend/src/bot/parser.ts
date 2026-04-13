/**
 * Natural language parser for Telegram messages.
 * Extracts transaction info from pt-BR sentences.
 */
export interface ParsedTransaction {
  type: 'INCOME' | 'EXPENSE';
  amount: number;
  description: string;
  categoryHint: string;
}

// Keywords that indicate income
const INCOME_KEYWORDS = [
  'recebi',
  'recebo',
  'recebi',
  'entrou',
  'ganhou',
  'ganhei',
  'salário',
  'salario',
  'pago',
  'me pagaram',
  'freelance',
  'vendi',
  'venda',
];

// Keywords that indicate expense
const EXPENSE_KEYWORDS = [
  'paguei',
  'gastei',
  'comprei',
  'compra',
  'gasto',
  'pago',
  'saiu',
  'debitou',
  'débito',
  'débito',
  'boleto',
  'conta',
  'parcela',
];

// Regex to find monetary values (supports R$ 1.000,50 or 1000.50 or 1000,50)
const AMOUNT_REGEX = /(?:R\$\s*)?(\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)/;

function parseAmount(raw: string): number {
  // Remove R$ and trim
  let clean = raw.replace(/R\$\s*/i, '').trim();
  // Handle pt-BR format: 1.000,50 → 1000.50
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  return parseFloat(clean);
}

export function parseMessage(text: string): ParsedTransaction | null {
  const lower = text.toLowerCase().trim();

  // Determine type
  let type: 'INCOME' | 'EXPENSE' | null = null;
  for (const kw of INCOME_KEYWORDS) {
    if (lower.includes(kw)) {
      type = 'INCOME';
      break;
    }
  }
  if (!type) {
    for (const kw of EXPENSE_KEYWORDS) {
      if (lower.includes(kw)) {
        type = 'EXPENSE';
        break;
      }
    }
  }

  // Find amount
  const amountMatch = text.match(new RegExp(AMOUNT_REGEX.source, 'i'));
  if (!amountMatch) return null;

  const amount = parseAmount(amountMatch[1]);
  if (isNaN(amount) || amount <= 0) return null;

  // If type still unknown, assume expense if amount is found
  if (!type) type = 'EXPENSE';

  // Extract description: remove money value, keep the rest meaningful
  let description = text
    .replace(new RegExp(AMOUNT_REGEX.source, 'gi'), '')
    .replace(/R\$/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean up leading/trailing common words
  const cleanWords = ['de', 'com', 'no', 'na', 'em', 'para', 'do', 'da'];
  const parts = description.split(' ').filter((p) => p.length > 0);
  while (parts.length > 0 && cleanWords.includes(parts[0].toLowerCase())) parts.shift();
  while (parts.length > 0 && cleanWords.includes(parts[parts.length - 1].toLowerCase()))
    parts.pop();
  description = parts.join(' ');

  // Category hint: last meaningful noun group
  const categoryHint = description.split(' ').slice(-2).join(' ');

  return {
    type,
    amount,
    description: description || `Transação de R$ ${amount.toFixed(2)}`,
    categoryHint,
  };
}

/**
 * Guess a category name from description hint
 */
export function guessCategoryName(hint: string): string {
  const lower = hint.toLowerCase();
  const mapping: [string[], string][] = [
    [['mercado', 'supermercado', 'feira', 'aliment', 'comida', 'restaur', 'lanche', 'pizza', 'ifood'], 'Alimentação'],
    [['uber', 'ônibus', 'onibus', 'gasolina', 'combustív', 'estacion', 'veículo', 'carro', 'metro', 'passagem'], 'Transporte'],
    [['farmácia', 'remédio', 'médico', 'saúde', 'consulta', 'hospital', 'plano de saúde'], 'Saúde'],
    [['netflix', 'cinema', 'lazer', 'jogo', 'viagem', 'show', 'evento', 'bar'], 'Lazer'],
    [['curso', 'livro', 'faculdade', 'escola', 'educa'], 'Educação'],
    [['aluguel', 'condom', 'luz', 'água', 'internet', 'energia', 'iptu', 'moradia'], 'Moradia'],
    [['salário', 'salario', 'pagamento', 'holerite'], 'Salário'],
    [['freelance', 'projeto', 'serviço'], 'Freelance'],
    [['dividendo', 'invest', 'rendimento', 'juros'], 'Investimentos'],
  ];

  for (const [keywords, category] of mapping) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return 'Outros';
}
