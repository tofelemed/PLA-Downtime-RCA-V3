import { relativeWindowOf } from '@/features/event-hub/model/relative-window';

/**
 * The shared analysis context (UX audit B-8): the units, the window and the approved-only choice that
 * every cross-module link carries, so Dashboard, Event Hub, Downtime, PLA and Reports open on the same
 * scope. URL contract (read by every target page):
 * - `units=a,b` (sorted unit ids; absent = every unit in scope)
 * - `window=<key>` alone for a rolling window (`24h`, `7d`, …), resolved by the target at its own "now";
 *   otherwise explicit `from` / `to` (UTC instants) with `window=<label>` as the display name
 * - `approved=1` / `approved=0` (absent = the target page's own default)
 */
export interface AnalysisContext {
  unitIds?: readonly string[];
  /** rolling window key; takes precedence over `from` / `to` */
  relativeWindow?: string;
  from?: string;
  to?: string;
  /** display name of explicit bounds */
  windowLabel?: string;
  approved?: boolean;
}

/** The URL parameters the context owns. */
export const ANALYSIS_CONTEXT_PARAMS: readonly string[] = ['units', 'from', 'to', 'window', 'approved'];
const WINDOW_PARAMS: readonly string[] = ['from', 'to', 'window'];

export type AnalysisArea = 'dashboard' | 'events' | 'downtime' | 'pla' | 'reports';

const AREA_ROOTS: ReadonlyArray<readonly [AnalysisArea, string]> = [
  ['dashboard', '/dashboard'],
  ['events', '/events'],
  ['downtime', '/downtime'],
  ['pla', '/pla-analytics'],
  ['reports', '/reports'],
];

/** The analysis module a path belongs to (its root or a sub-path); null outside the analysis modules. */
export function analysisAreaOf(path: string): AnalysisArea | null {
  const pathname = path.split(/[?#]/)[0];
  const match = AREA_ROOTS.find(([, root]) => pathname === root || pathname.startsWith(`${root}/`));
  return match ? match[0] : null;
}

const isInstant = (value: string | null): value is string => value !== null && !Number.isNaN(Date.parse(value));

function windowOf(params: URLSearchParams): Pick<AnalysisContext, 'relativeWindow' | 'from' | 'to' | 'windowLabel'> {
  const from = params.get('from');
  const to = params.get('to');
  const name = params.get('window');
  if (isInstant(from) && isInstant(to) && Date.parse(from) < Date.parse(to)) {
    return name ? { from, to, windowLabel: name } : { from, to };
  }
  const rolling = relativeWindowOf(name);
  return rolling ? { relativeWindow: rolling.key } : {};
}

/** The context named by a URL query (invalid or missing parts are left out). */
export function readAnalysisContext(search: string | URLSearchParams): AnalysisContext {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  const context: AnalysisContext = { ...windowOf(params) };
  const units = (params.get('units') ?? '').split(',').filter(Boolean);
  if (units.length > 0) context.unitIds = [...units].sort();
  const approved = params.get('approved');
  if (approved === '1' || approved === '0') context.approved = approved === '1';
  return context;
}

/** The URL form of the context (only the parts it holds). */
export function analysisContextParams(context: AnalysisContext): URLSearchParams {
  const params = new URLSearchParams();
  if (context.relativeWindow) {
    params.set('window', context.relativeWindow);
  } else if (context.from && context.to) {
    params.set('from', context.from);
    params.set('to', context.to);
    if (context.windowLabel) params.set('window', context.windowLabel);
  }
  if (context.unitIds && context.unitIds.length > 0) params.set('units', [...context.unitIds].sort().join(','));
  if (context.approved !== undefined) params.set('approved', context.approved ? '1' : '0');
  return params;
}

/**
 * `href` with the context added. What the link already names wins: its own window (any of `from`, `to`,
 * `window`) keeps the context window out, and its own `units` / `approved` stay. The hash is kept.
 *
 * @example withAnalysisContext('/events?kinds=downtime', { relativeWindow: '30d' }) // '/events?kinds=downtime&window=30d'
 */
export function withAnalysisContext(href: string, context: AnalysisContext): string {
  const hashAt = href.indexOf('#');
  const hash = hashAt >= 0 ? href.slice(hashAt) : '';
  const base = hashAt >= 0 ? href.slice(0, hashAt) : href;
  const queryAt = base.indexOf('?');
  const path = queryAt >= 0 ? base.slice(0, queryAt) : base;
  const params = new URLSearchParams(queryAt >= 0 ? base.slice(queryAt + 1) : '');
  const ownWindow = WINDOW_PARAMS.some((key) => params.has(key));
  for (const [key, value] of analysisContextParams(context)) {
    if (params.has(key) || (ownWindow && WINDOW_PARAMS.includes(key))) continue;
    params.set(key, value);
  }
  const query = params.toString();
  return `${path}${query ? `?${query}` : ''}${hash}`;
}
