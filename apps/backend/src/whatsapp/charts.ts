import { Resvg } from '@resvg/resvg-js';
import { formatBRL } from './format';

/** Gráficos do relatório como PNG, desenhados em SVG (sem navegador) e rasterizados com resvg. */

export type CategorySlice = { name: string; value: number; color: string };
export type SeriesPoint = { label: string; income: number; expense: number };

const BG = '#1d1d21';
const FG = '#e8e8ea';
const MUTED = '#9a9ba3';
const GRID = '#34353c';
const INCOME = '#6FA981';
const EXPENSE = '#CD7C6B';
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
    return [require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans.ttf'), require.resolve('dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf')];
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

function text(x: number, y: number, s: string, opts: { size?: number; fill?: string; anchor?: string; bold?: boolean } = {}): string {
  const { size = 14, fill = FG, anchor = 'start', bold = false } = opts;
  return `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" fill="${fill}" text-anchor="${anchor}"${bold ? ' font-weight="700"' : ''}>${esc(s)}</text>`;
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

function axisLabel(v: number): string {
  return v >= 1000 ? `R$${(v / 1000).toFixed(v >= 10000 ? 0 : 1).replace('.', ',')}k` : `R$${Math.round(v)}`;
}

/** Linhas de entradas e saídas por mês (mesmo visual do card "Entradas e saídas" do dashboard). */
export function incomeExpenseLinePng(points: SeriesPoint[], title: string): Buffer {
  const W = 640;
  const H = 380;
  const left = 64;
  const right = 40;
  const top = 72;
  const bottom = 64;
  const pw = W - left - right;
  const ph = H - top - bottom;

  const maxV = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  const raw = maxV / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const ticks = Math.ceil(maxV / step);
  const ceil = ticks * step;
  const x = (i: number) => left + (points.length === 1 ? pw / 2 : (i / (points.length - 1)) * pw);
  const y = (v: number) => top + ph - (v / ceil) * ph;

  const grid = Array.from({ length: ticks + 1 }, (_, k) => k)
    .map((k) => {
      const v = step * k;
      return `<line x1="${left}" y1="${y(v)}" x2="${W - right}" y2="${y(v)}" stroke="${GRID}" stroke-dasharray="4 4"/>${text(left - 10, y(v) + 4, axisLabel(v), { size: 11, fill: MUTED, anchor: 'end' })}`;
    })
    .join('');
  // Poucos rótulos no eixo X: de N em N pontos, e o último só se couber sem encostar no anterior.
  const stride = Math.max(1, Math.ceil(points.length / 7));
  const shown: number[] = [];
  points.forEach((_, i) => {
    if (i % stride === 0) shown.push(i);
  });
  const last = points.length - 1;
  if (last >= 0 && shown[shown.length - 1] !== last && last - shown[shown.length - 1] > stride / 2) shown.push(last);
  const xs = shown.map((i) => text(x(i), H - bottom + 24, points[i].label, { size: 12, fill: MUTED, anchor: 'middle' })).join('');

  const line = (key: 'income' | 'expense', color: string) => {
    const pts = points.map((p, i) => `${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
    const dots = (points.length > 40 ? [] : points).map((p, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(p[key]).toFixed(1)}" r="4" fill="${color}"/>`).join('');
    return `<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>${dots}`;
  };

  const legendY = H - 16;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<rect width="${W}" height="${H}" fill="${BG}"/>
${text(32, 38, title, { size: 20, bold: true })}
${grid}${xs}
${line('income', INCOME)}${line('expense', EXPENSE)}
<circle cx="${W / 2 - 70}" cy="${legendY - 4}" r="5" fill="${INCOME}"/>${text(W / 2 - 60, legendY, 'Entradas', { size: 13, fill: MUTED })}
<circle cx="${W / 2 + 20}" cy="${legendY - 4}" r="5" fill="${EXPENSE}"/>${text(W / 2 + 30, legendY, 'Saídas', { size: 13, fill: MUTED })}
</svg>`;
  return toPng(svg);
}
