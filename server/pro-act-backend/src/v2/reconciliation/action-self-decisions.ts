import { EntityManager } from 'typeorm';
import { ApprovalAction } from '../../reconciliation/entities/approval-action.entity';
import {
  INDEPENDENT_ACTIONS,
  workflowActionSelfDecided,
} from '../../domain/reconciliation/self-approval';

interface RevisionPartiesRow {
  id: string;
  opener: string | null;
  line_authors: string[] | null;
}

interface SubmissionStepRow {
  revision_id: string;
  action: string;
  actor_id: string | null;
  submitted_hash: string | null;
}

/** Opener and line authors of the revisions (the current line set: the approved one once approved). */
const REVISION_PARTIES = `
  SELECT r."id"::text AS "id",
         CASE WHEN r."supersedes_id" IS NOT NULL THEN r."created_by"::text END AS "opener",
         ARRAY(SELECT DISTINCT l."author_id"::text FROM "reconciliation_lines" l
                WHERE l."line_set_id" = r."current_line_set_id" AND l."author_id" IS NOT NULL) AS "line_authors"
    FROM "accounting_revisions" r
   WHERE r."tenant_id" = $1 AND r."id" = ANY($2::uuid[])`;

/** Who submitted, and who bridge-reviewed, each submission (by submitted hash) of the revisions. */
const SUBMISSION_STEPS = `
  SELECT a."revision_id"::text AS "revision_id", a."action", a."actor_id"::text AS "actor_id", a."submitted_hash"
    FROM "approval_actions" a
   WHERE a."tenant_id" = $1 AND a."revision_id" = ANY($2::uuid[])
     AND a."action" IN ('submit', 'bridge_review')
   ORDER BY a."created_at", a."id"`;

const stepKey = (revisionId: string, hash: string | null, action: string) =>
  `${revisionId}|${hash ?? ''}|${action}`;

/**
 * Item 1.3: ids of the page's approve / reject / bridge-review actions that decided the actor's own
 * submission, derived from stored actor ids (two queries per page, never per row).
 */
export async function selfDecidedActionIds(
  manager: EntityManager,
  tenantId: string,
  actions: readonly ApprovalAction[],
): Promise<Set<string>> {
  const decisions = actions.filter(
    (a) => a.actorId && INDEPENDENT_ACTIONS.has(a.action),
  );
  if (decisions.length === 0) return new Set();
  const ids = [...new Set(decisions.map((a) => a.revisionId))];
  const revisions: RevisionPartiesRow[] = await manager.query(
    REVISION_PARTIES,
    [tenantId, ids],
  );
  const steps: SubmissionStepRow[] = await manager.query(SUBMISSION_STEPS, [
    tenantId,
    ids,
  ]);
  const byRevision = new Map(revisions.map((r) => [r.id, r]));
  // Ordered oldest first: the last write per key is the latest step of that submission.
  const actorOf = new Map(
    steps.map((s) => [
      stepKey(s.revision_id, s.submitted_hash, s.action),
      s.actor_id,
    ]),
  );
  const self = new Set<string>();
  for (const a of decisions) {
    const revision = byRevision.get(a.revisionId);
    const parties = {
      submittedBy:
        actorOf.get(stepKey(a.revisionId, a.submittedHash, 'submit')) ?? null,
      revisionOpenedBy: revision?.opener ?? null,
      lineAuthors: revision?.line_authors ?? [],
      bridgeReviewer:
        actorOf.get(stepKey(a.revisionId, a.submittedHash, 'bridge_review')) ??
        null,
    };
    if (workflowActionSelfDecided(a.action, a.actorId, parties)) self.add(a.id);
  }
  return self;
}
