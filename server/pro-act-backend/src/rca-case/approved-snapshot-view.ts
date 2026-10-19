import { EntityManager } from 'typeorm';
import { DefaultBasis } from '../domain/valuation/valuation.types';
import { approvedImpact, ApprovedImpact } from './approved-impact';

/** A valuation view fixed by the caller, with where it comes from (named in the basis). */
export interface FixedView {
  view: DefaultBasis;
  viewSource: string;
}

const VIEWS: readonly DefaultBasis[] = [
  'contribution_margin',
  'standard_cost',
  'economic_impact',
];

/** Words of where the view comes from, after its name in the basis sentence. */
export const SNAPSHOT_VIEW_SOURCE =
  'the view frozen when the periods were approved';

/** The one known view among the frozen ones; undefined when none is frozen or they disagree. */
export function singleView(
  frozen: ReadonlyArray<string | null>,
): DefaultBasis | undefined {
  const known = new Set(frozen.filter((view): view is string => !!view));
  if (known.size !== 1) return undefined;
  const [only] = [...known];
  return VIEWS.find((candidate) => candidate === only);
}

/** Periods carrying the events' (or lines') loss, then the view frozen in each one's latest approval. */
const SNAPSHOT_VIEWS = (filter: 'event' | 'line') => `
  WITH periods AS (
    SELECT l."period_id" FROM "loss_lines" l
     WHERE l."tenant_id" = $1 AND ${filter === 'event' ? 'l."cause_event_id"' : 'l."id"'} = ANY($2::uuid[])
    UNION
    SELECT a."period_id" FROM "approved_loss_lines" a
     WHERE a."tenant_id" = $1 AND ${filter === 'event' ? 'a."cause_event_id"' : 'a."source_id"'} = ANY($2::uuid[])),
  latest AS (
    SELECT (SELECT ar."id" FROM "accounting_revisions" ar
             WHERE ar."tenant_id" = $1 AND ar."period_id" = p."period_id" AND ar."lifecycle" = 'approved'
             ORDER BY ar."revision" DESC LIMIT 1) AS "revision_id"
      FROM periods p)
  SELECT DISTINCT s."content" -> 'reviewed' -> 'valuation' ->> 'defaultView' AS "view"
    FROM latest x JOIN "approval_snapshots" s ON s."tenant_id" = $1 AND s."revision_id" = x."revision_id"`;

/**
 * QA M3 (re-test): the approved figure of an investigation is valued in the view frozen in the approval
 * snapshots of the periods that carry it (approved records are immutable; owner 18 Oct 2026), the same view
 * the period itself shows — not whatever the policy's default is now. Undefined when no approved period
 * froze a view, or the periods froze different ones (the caller then uses the policy's default view).
 */
export async function approvedSnapshotView(
  manager: EntityManager,
  tenantId: string,
  target: { eventIds?: string[]; lineIds?: string[] },
): Promise<FixedView | undefined> {
  const filter = target.lineIds ? 'line' : 'event';
  const ids = target.lineIds ?? target.eventIds ?? [];
  if (ids.length === 0) return undefined;
  const rows: Array<{ view: string | null }> = await manager.query(
    SNAPSHOT_VIEWS(filter),
    [tenantId, ids],
  );
  const view = singleView(rows.map((row) => row.view));
  return view ? { view, viewSource: SNAPSHOT_VIEW_SOURCE } : undefined;
}

/** Approved impact of events or lines in the view frozen when their periods were approved (else the default). */
export async function approvedImpactAsApproved(
  manager: EntityManager,
  tenantId: string,
  target: { eventIds?: string[]; lineIds?: string[] },
): Promise<ApprovedImpact> {
  const fixed = await approvedSnapshotView(manager, tenantId, target);
  return approvedImpact(manager, tenantId, { ...target, ...fixed });
}
