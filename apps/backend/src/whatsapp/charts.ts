import { Resvg } from '@resvg/resvg-js';
import { formatBRL } from './format';

/** Gráficos do relatório como PNG, desenhados em SVG (sem navegador) e rasterizados com resvg. */

export type CategorySlice = { name: string; value: number; color: string };

const BG = '#1d1d21';
const FG = '#e8e8ea';
const MUTED = '#9a9ba3';
const GRID = '#34353c';
const INCOME = '#6FA981';
const EXPENSE = '#CD7C6B';
const ACCENT = '#c8904f';
const MONO = 'DejaVu Sans Mono';
const FONT = 'DejaVu Sans';
const MAX_SLICES = 8;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function clip(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

/** Cor vinda do banco entra no SVG: só aceita #rgb/#rrggbb. */
function safeColor(c: string): string {
  return /^#[0-9a-f]{3}([0-9a-f]{3})?$/i.test(c) ? c : '#6b7280';
}

function fontFiles(): string[] {
  try {
    return ['DejaVuSans', 'DejaVuSans-Bold', 'DejaVuSansMono-Bold'].map((f) =>
      require.resolve(`dejavu-fonts-ttf/ttf/${f}.ttf`)
    );
  } catch {
    return [];
  }
}

function toPng(svg: string): Buffer {
  const files = fontFiles();
  return new Resvg(svg, {
    fitTo: { mode: 'zoom', value: 2 },
    font: { fontFiles: files, loadSystemFonts: files.length === 0, defaultFontFamily: FONT },
  })
    .render()
    .asPng();
}

function text(
  x: number,
  y: number,
  s: string,
  opts: { size?: number; fill?: string; anchor?: string; bold?: boolean; mono?: boolean; spacing?: number } = {}
): string {
  const { size = 14, fill = FG, anchor = 'start', bold = false, mono = false, spacing = 0 } = opts;
  return `<text x="${x}" y="${y}" font-family="${mono ? MONO : FONT}"${spacing ? ` letter-spacing="${spacing}"` : ''} font-size="${size}" fill="${fill}" text-anchor="${anchor}"${bold ? ' font-weight="700"' : ''}>${esc(s)}</text>`;
}

/** Rosca de despesas por categoria + legenda com valores. Agrupa o excedente em "Outras". */
export function categoryDonutPng(slices: CategorySlice[], title: string): Buffer {
  const sorted = slices.filter((s) => s.value > 0).sort((a, b) => b.value - a.value);
  const shown = sorted.slice(0, MAX_SLICES);
  const rest = sorted.slice(MAX_SLICES).reduce((s, c) => s + c.value, 0);
  if (rest > 0) shown.push({ name: 'Outras', value: rest, color: '#6b7280' });
  const total = shown.reduce((s, c) => s + c.value, 0);

  const W = 640;
  const cx = W / 2;
  const cy = 190;
  const R = 130;
  const r = 80;
  const rowH = 30;
  const legendTop = 360;
  const H = legendTop + shown.length * rowH + 24;

  const arcs: string[] = [];
  if (shown.length === 1) {
    arcs.push(`<circle cx="${cx}" cy="${cy}" r="${(R + r) / 2}" fill="none" stroke="${safeColor(shown[0].color)}" stroke-width="${R - r}"/>`);
  } else {
    let a0 = -Math.PI / 2;
    for (const s of shown) {
      const a1 = a0 + (s.value / total) * Math.PI * 2;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const p = (rad: number, a: number) => `${(cx + rad * Math.cos(a)).toFixed(2)} ${(cy + rad * Math.sin(a)).toFixed(2)}`;
      arcs.push(
        `<path d="M ${p(R, a0)} A ${R} ${R} 0 ${large} 1 ${p(R, a1)} L ${p(r, a1)} A ${r} ${r} 0 ${large} 0 ${p(r, a0)} Z" fill="${safeColor(s.color)}" stroke="${BG}" stroke-width="2"/>`
      );
      a0 = a1;
    }
  }

  const legend = shown
    .map((s, i) => {
      const y = legendTop + i * rowH;
      const pct = Math.round((s.value / total) * 100);
      return [
        `<rect x="48" y="${y - 12}" width="6" height="18" rx="3" fill="${safeColor(s.color)}"/>`,
        text(68, y + 3, `${clip(s.name, 26)}  ·  ${pct}%`, { size: 15, fill: MUTED }),
        text(W - 48, y + 3, formatBRL(s.value), { size: 15, anchor: 'end', bold: true }),
      ].join('');
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${BG}"/>
${text(32, 38, title, { size: 20, bold: true })}
${arcs.join('')}
${text(cx, cy - 4, 'Total', { size: 13, fill: MUTED, anchor: 'middle' })}
${text(cx, cy + 20, formatBRL(total), { size: 20, anchor: 'middle', bold: true })}
${legend}
</svg>`;
  return toPng(svg);
}

/**
 * Cartão de resumo do período, no estilo do topo do dashboard: entradas, saídas, saldo,
 * taxa de poupança e barra de renda comprometida.
 */
export function summaryCardPng(d: { label: string; income: number; expense: number }): Buffer {
  const W = 640;
  const H = 400;
  const saldo = d.income - d.expense;
  const rate = d.income > 0 ? Math.round((saldo / d.income) * 100) : 0;
  const committed = d.income > 0 ? Math.min(100, (d.expense / d.income) * 100) : 0;
  const label = d.label.charAt(0).toUpperCase() + d.label.slice(1);
  const barX = 40;
  const barW = W - 80;

  const cell = (cx: number, name: string, value: number, color: string) =>
    text(cx, 118, name.toUpperCase(), { size: 12, fill: MUTED, anchor: 'middle', spacing: 2 }) +
    text(cx, 148, formatBRL(value), { size: 20, fill: color, anchor: 'middle', bold: true, mono: true });

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="#121214"/>
${text(32, 44, 'Visão geral', { size: 22, bold: true })}
${text(W - 32, 44, label, { size: 15, fill: MUTED, anchor: 'end' })}
<rect x="24" y="72" width="${W - 48}" height="${H - 96}" rx="16" fill="${BG}" stroke="${GRID}"/>
${cell(W / 4 + 6, 'Entradas', d.income, INCOME)}${cell((W * 3) / 4 - 6, 'Saídas', d.expense, EXPENSE)}
<line x1="${W / 2}" y1="90" x2="${W / 2}" y2="166" stroke="${GRID}"/>
<line x1="24" y1="180" x2="${W - 24}" y2="180" stroke="${GRID}"/>
${text(40, 218, 'SALDO DO PERÍODO', { size: 12, fill: MUTED, spacing: 2 })}
${text(40, 270, formatBRL(saldo), { size: 44, bold: true, mono: true })}
${text(40, 306, `${rate}%`, { size: 16, bold: true })}${text(40 + String(rate).length * 10 + 28, 306, 'taxa de poupança', { size: 16, fill: MUTED })}
<rect x="${barX}" y="326" width="${barW}" height="8" rx="4" fill="#2c2d33"/>
${committed > 0 ? `<rect x="${barX}" y="326" width="${Math.max(8, (barW * committed) / 100).toFixed(1)}" height="8" rx="4" fill="${ACCENT}"/>` : ''}
${text(W - 40, 360, d.income > 0 ? `${Math.round(committed)}% da renda comprometida` : 'sem entradas no período', { size: 13, fill: MUTED, anchor: 'end' })}
</svg>`;
  return toPng(svg);
}
