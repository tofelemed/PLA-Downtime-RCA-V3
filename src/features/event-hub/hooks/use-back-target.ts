import { useLocation } from 'react-router-dom';
import { DOWNTIME_PAGES, PLA_PAGES } from '@/features/analysis-navigation/analysis-pages';

export interface BackTarget {
  to: string;
  label: string;
}

const FALLBACK: BackTarget = { to: '/events', label: 'Event Hub' };
const SAFE_ID = '[a-zA-Z0-9_-]+';
const EVENT_PATH = new RegExp(`^/events/${SAFE_ID}$`);
const RCA_PATH = new RegExp(`^/rca/${SAFE_ID}$`);
/** Period workspace and its sub-pages (`/plans/:planId/periods/:periodId/adjustments/new`, …). */
const PERIOD_PATH = new RegExp(`^/plans/${SAFE_ID}/periods/${SAFE_ID}(?:/${SAFE_ID})*$`);
const PLAN_PATH = new RegExp(`^/plans/${SAFE_ID}$`);
/** Analysis pages a stop can be opened from (B-4), labelled with their page titles. */
const ANALYSIS_LABELS: ReadonlyMap<string, string> = new Map([...DOWNTIME_PAGES, ...PLA_PAGES].map((page) => [page.path, page.name]));

function hasUnsafeCharacter(value: string): boolean {
  return [...value].some((character) => character === '\\' || character.charCodeAt(0) <= 32 || character.charCodeAt(0) === 127);
}

function labelOfPath(pathname: string): string | null {
  const analysis = ANALYSIS_LABELS.get(pathname);
  if (analysis) return analysis;
  if (pathname === '/events' || pathname === '/events/') return 'Event Hub';
  if (EVENT_PATH.test(pathname)) return 'Event';
  if (RCA_PATH.test(pathname)) return 'Investigation';
  if (PERIOD_PATH.test(pathname)) return 'Period';
  if (PLAN_PATH.test(pathname)) return 'Plan';
  return null;
}

/** Only in-app routes written by our own links (event, downtime, PLA, investigation, plan, period) can become a return destination. */
export function eventBackTarget(value: unknown): BackTarget {
  if (typeof value !== 'string' || hasUnsafeCharacter(value)) return FALLBACK;
  const label = labelOfPath(value.split(/[?#]/, 1)[0]);
  return label ? { to: value, label } : FALLBACK;
}

/** Where "Back" goes from an event page: the page the user came from, with its filters. */
export function useBackTarget(): BackTarget {
  const state = useLocation().state as { listSearch?: unknown } | null;
  return eventBackTarget(state?.listSearch);
}
