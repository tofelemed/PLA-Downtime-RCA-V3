/**
 * RCA cases through the v2 RCA routes, opened by reliability engineers: linked to the biggest stops of
 * their reason (or of their unit), with team, recommendations, actions (owners, due dates, baselines,
 * claimed avoided loss in USD), a verified action whose window has ended, and two cases closed by a
 * manager (closing creates the knowledge-base entry). Cases are found by title and kept.
 */
import {
  ActionSpec,
  CaseSpec,
  RCA_CASES,
  SMALL_RCA_CASES,
} from './catalog-rca';
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { DAY_MS, iso } from './showcase-window';

interface CaseRow {
  id: string;
  title: string;
  status: string;
  rowVersion: number;
}

interface ActionRow {
  id: string;
  rowVersion: number;
}

interface StopRow {
  id: string;
  eventId: string | null;
  reasonCodeId: string | null;
  durationSeconds: number | null;
  classification: { physicalType: string };
}

const STATUS: Record<CaseSpec['stage'], string> = {
  draft: 'Draft',
  analysis: 'Analysis',
  actions_open: 'In Progress',
  verified: 'Published',
  closed: 'Published',
};

/** The three longest stops of the case's reason on its unit (else of the unit). */
async function biggestStops(
  ctx: ShowcaseContext,
  spec: CaseSpec,
  session: PersonaSession,
): Promise<StopRow[]> {
  const unitId = ctx.ids.units.get(spec.unitKey) ?? '';
  const stops = (
    await session.listAll<StopRow>('/v2/production-events', {
      unitIds: unitId,
      physicalTypes: 'downtime',
      from: iso(ctx.window.from),
      to: iso(ctx.window.now),
    })
  ).filter((s) => s.eventId?.startsWith('SC-') && s.durationSeconds);
  const reasonId = ctx.ids.reasons.get(spec.reason);
  const ofReason = stops.filter((s) => s.reasonCodeId === reasonId);
  const pool = ofReason.length ? ofReason : stops;
  return pool
    .sort((a, b) => (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0))
    .slice(0, 3);
}

function caseBody(
  ctx: ShowcaseContext,
  spec: CaseSpec,
  lead: string,
): Record<string, unknown> {
  const members = [
    ...ctx.scenario.cast.engineers.slice(0, 2),
    ctx.persona('operators', 0),
  ]
    .map((p) => ctx.ids.users.get(p))
    .filter((id): id is string => !!id);
  return {
    title: spec.title,
    description: spec.description,
    status: STATUS[spec.stage],
    priority: spec.priority,
    unitId: ctx.ids.units.get(spec.unitKey),
    teamLeadId: ctx.ids.users.get(lead) ?? null,
    teamMemberIds: spec.stage === 'draft' ? [] : members,
    targetCloseDate: iso(ctx.window.today + 21 * DAY_MS),
    rootCause: spec.rootCause,
    recommendations: spec.recommendations.map((title) => ({ title })),
  };
}

function actionBody(
  ctx: ShowcaseContext,
  action: ActionSpec,
  index: number,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: action.title,
    description: action.description,
    ownerId: ctx.ids.users.get(ctx.persona(action.ownerRole, index)) ?? null,
    dueDate: iso(ctx.window.today + action.dueInDays * DAY_MS),
    status: action.status,
  };
  if (action.verification) {
    body.verificationWindowStart = iso(
      ctx.window.today - action.verification.fromDaysAgo * DAY_MS,
    );
    body.verificationWindowEnd = iso(
      ctx.window.today - action.verification.toDaysAgo * DAY_MS,
    );
  }
  if (action.baselineRecurrences) {
    body.baseline = {
      metric: 'recurrences',
      windowDays: 30,
      value: action.baselineRecurrences,
    };
  }
  if (action.claimedAvoidedLossUsd) {
    body.claimedAvoidedLoss = action.claimedAvoidedLossUsd;
    body.claimedCurrency = 'USD';
  }
  if (action.status === 'done')
    body.completionEvidenceRef = `CMMS-WO-${4100 + index}`;
  return body;
}

async function openCase(
  ctx: ShowcaseContext,
  spec: CaseSpec,
  index: number,
): Promise<void> {
  const lead = ctx.persona('reliability', index);
  const session = ctx.session(lead);
  const created = await session.post<CaseRow>(
    '/v2/rcas',
    caseBody(ctx, spec, lead),
    `rca ${spec.title}`,
  );
  for (const stop of await biggestStops(ctx, spec, session)) {
    await session.post(
      `/v2/rcas/${created.id}/links`,
      {
        linkType: 'event',
        targetId: stop.id,
        reason: 'One of the largest stops of this cause',
      },
      `rca link ${created.id} ${stop.id}`,
    );
  }
  for (const [i, action] of spec.actions.entries()) {
    const row = await session.post<ActionRow>(
      `/v2/rcas/${created.id}/actions`,
      actionBody(ctx, action, i),
      `rca action ${created.id} ${i}`,
    );
    if (action.verification) {
      await session.post(
        `/v2/rca-actions/${row.id}/verify`,
        {},
        `verify ${row.id}`,
        { ifMatch: row.rowVersion },
      );
    }
  }
  if (spec.stage !== 'closed') return;
  const current = await session.get<CaseRow>(`/v2/rcas/${created.id}`);
  await ctx
    .as('managers', index)
    .call(
      'PATCH',
      `/v2/rcas/${created.id}`,
      { status: 'Closed', actualCloseDate: iso(ctx.window.today - 2 * DAY_MS) },
      { ifMatch: current.rowVersion },
    );
}

export async function seedRcaCases(ctx: ShowcaseContext): Promise<void> {
  const specs = ctx.scenario.kind === 'full' ? RCA_CASES : SMALL_RCA_CASES;
  const existing = await ctx.as('reliability', 0).listAll<CaseRow>('/v2/rcas');
  for (const [index, spec] of specs.entries()) {
    if (!ctx.ids.units.has(spec.unitKey)) continue;
    if (existing.some((c) => c.title === spec.title)) {
      ctx.tally.kept('rca cases');
      continue;
    }
    ctx.tally.add('rca cases', 1, 0, `${spec.stage}`);
    if (!ctx.dryRun) await openCase(ctx, spec, index);
  }
}
