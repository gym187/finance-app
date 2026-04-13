/**
 * Formatting helpers for Telegram bot messages (pt-BR)
 */

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function formatBRL(value: number): string {
  return BRL.format(value);
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function currentMonthName(): string {
  return new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function progressBar(percentage: number, length = 10): string {
  const filled = Math.round((Math.min(percentage, 100) / 100) * length);
  const empty = length - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const emoji = percentage >= 100 ? '🔴' : percentage >= 80 ? '🟡' : '🟢';
  return `${emoji} ${bar} ${percentage.toFixed(0)}%`;
}
