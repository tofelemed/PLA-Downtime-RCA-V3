import type { ProductionEventFilters } from '@/api/v2/queries/production-events';
import type { CodeView } from '@/api/v2/types/flags';
import type { DowntimeGroupView, DowntimeReportView } from '@/api/v2/types/reports';
import { downtimeQuery, type DowntimeFilters, type DowntimeQuery, type ScheduleFilter } from './downtime-filters';

/** Level 1 of the Pareto, or the children of the last reason on the drill path (server grouping). */
export function paretoQuery(filters: DowntimeFilters): DowntimeQuery {
  const parent = filters.reasonPath[filters.reasonPath.length - 1];
  return parent
    ? downtimeQuery(filters, 'reasonChild', { parentReasonId: parent })
    : downtimeQuery(filters, 'reasonLevel1');
}

export function hasChildren(reasonId: string, codes: readonly CodeView[]): boolean {
  return codes.some((code) => code.parentId === reasonId);
}

/** The bar whose events are listed, with the server figure it showed (drill-through check). */
export interface DrillSelection {
  reasonId: string | null;
  label: string;
  group: DowntimeGroupView;
  unit: 's' | 'count';
}

/** What a click on a Pareto bar does: go one level deeper, or list the bar's events. */
export type BarAction = { kind: 'drill'; reasonId: string } | { kind: 'events'; reasonId: string | null };

/**
 * A bar with child codes drills down; a leaf, a bar coded at its parent's own level (key = the
 * parent) or the not-coded bar lists events.
 */
export function barAction(group: DowntimeGroupView, path: readonly string[], codes: readonly CodeView[]): BarAction {
  const key = group.key;
  if (key === null) return { kind: 'events', reasonId: null };
  if (path[path.length - 1] === key || !hasChildren(key, codes)) return { kind: 'events', reasonId: key };
  return { kind: 'drill', reasonId: key };
}

/** A reason and every code below it in the library (materialised `path` of ids). */
export function subtreeIds(reasonId: string, codes: readonly CodeView[]): string[] {
  const ids = codes
    .filter((code) => code.id === reasonId || code.path.split('/').includes(reasonId))
    .map((code) => code.id);
  return [...new Set([reasonId, ...ids])].sort();
}

const DRILL_PAGE = 100;

/**
 * The event list behind a Pareto bar (AN01 drill-through): the same units, window and schedule class
 * as the report, downtime events coded in the bar's subtree (or not coded), current history only.
 * The list is a keyset page from the server, never used to compute a figure.
 */
export function drillEventQuery(filters: DowntimeFilters, reasonId: string | null, codes: readonly CodeView[]): ProductionEventFilters {
  const query: Record<string, unknown> = {
    limit: DRILL_PAGE,
    sort: '-startTime',
    from: filters.from,
    to: filters.to,
    physicalTypes: ['downtime'],
    physicalStates: ['closed', 'open'],
  };
  if (filters.unitIds.length > 0) query.unitIds = [...filters.unitIds].sort();
  if (filters.scheduleClass !== 'all') query.scheduleClasses = [filters.scheduleClass satisfies ScheduleFilter];
  if (reasonId === null) query.codingStates = ['uncoded'];
  else query.reasonIds = subtreeIds(reasonId, codes);
  return query as ProductionEventFilters;
}

/** Breadcrumb of the drill path with the library names. */
export function drillCrumbs(path: readonly string[], codes: readonly CodeView[]): Array<{ id: string; label: string }> {
  return path.map((id) => {
    const code = codes.find((entry) => entry.id === id);
    return { id, label: code ? `${code.code} · ${code.name}${code.active ? '' : ' (retired)'}` : 'Unknown reason' };
  });
}

/** URL value of the listed bar (QA audit L15: the list survives a visit to a stop and Back). */
export const DRILL_PARAM = 'drill';
const UNCODED_BAR = 'uncoded';

/** Name of a Pareto bar: the server label, else "Unknown reason" / "Not coded". */
export function barLabel(group: DowntimeGroupView): string {
  return group.label ?? (group.key ? 'Unknown reason' : 'Not coded');
}

export function drillParamOf(selection: Pick<DrillSelection, 'reasonId'>): string {
  return selection.reasonId ?? UNCODED_BAR;
}

/**
 * The listed bar from the URL value and the Pareto the page shows: only a bar of this level that lists its
 * stops (not one that drills deeper); null when the value no longer names such a bar.
 */
export function drillSelectionOf(
  value: string | null,
  report: Pick<DowntimeReportView, 'groups' | 'unit'> | undefined,
  context: { path: readonly string[]; codes: readonly CodeView[] },
): DrillSelection | null {
  if (!value || !report) return null;
  const key = value === UNCODED_BAR ? null : value;
  const group = report.groups.find((entry) => entry.key === key);
  if (!group || barAction(group, context.path, context.codes).kind !== 'events') return null;
  return { reasonId: key, label: barLabel(group), group, unit: report.unit };
}
