const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 1234.5 -> "R$ 1.234,50" (espaço comum, sem NBSP). */
export function formatBRL(n: number): string {
  return brl.format(n).replace(/ /g, ' ');
}

/** Minúsculas, sem acentos/pontuação, espaços colapsados. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
