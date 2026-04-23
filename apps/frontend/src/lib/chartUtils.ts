/** Shared Recharts contentStyle — readable on both light and dark themes */
export const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '12px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
};

export const TOOLTIP_CURSOR_STYLE = {
  fill: 'hsl(var(--muted))',
  opacity: 0.5,
};
