/**
 * Recharts text helpers shared by the analysis charts. Tooltip text in the foreground colour on the popover
 * surface (axe colour-contrast: series colours are too light as text on white, QA L27).
 */
export const CHART_TOOLTIP_STYLE = {
  contentStyle: { backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', color: 'hsl(var(--popover-foreground))' },
  labelStyle: { color: 'hsl(var(--popover-foreground))' },
  itemStyle: { color: 'hsl(var(--popover-foreground))' },
} as const;

/**
 * An axis tick that never wraps: Recharts breaks tick text at spaces, so "1 h 15 min" read "1 h 15min"
 * (QA L25). Non-breaking spaces keep the words on one line.
 */
export function unbreakable(text: string): string {
  return text.replace(/ /g, ' ');
}
