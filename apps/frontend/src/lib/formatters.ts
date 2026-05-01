/**
 * BRL currency and date formatters for pt-BR locale
 */

export const formatBRL = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatPercent = (value: number, decimals = 1): string =>
  `${value.toFixed(decimals)}%`;

export const formatDate = (date: string | Date): string =>
  new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit', year: 'numeric' });

export const formatMonthLabel = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
};

export const currentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

export const monthLabel = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
};

// Returns today's date as YYYY-MM-DD in Brazil timezone (UTC-3).
// Use this instead of new Date().toISOString().split('T')[0] to avoid
// the date flipping to the next day after 21:00 BR (midnight UTC).
export const todayBR = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
