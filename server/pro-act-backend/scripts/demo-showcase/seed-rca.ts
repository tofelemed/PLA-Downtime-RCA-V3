/**
 * DEMO RCA cases (catalog-rca) through the v2 RCA routes and the SME CA1 workflow: a reliability engineer
 * opens each case (from the trigger recommendation's event when the story says so), links its stops,
 * writes the 5-Why with evidence, adds evidenced actions with a server-computed baseline, verifies the
 * actions whose window has ended, and moves the case through its transitions; closure is approved by a
 * manager who is not on the team, and the closed case's lesson is published and shared with the other
 * plants of the organization. Cases are found by title and kept. Titles and log lines say "Demo".
 */
import { CaseSpec } from './catalog-rca';
import { actionBody, caseBody, fiveWhyBody } from './rca-case-bodies';
import { caseSpecs, failureStopsOf } from './seed-rca-events';
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { iso } from './showcase-window';

interface CaseRow {
  id: string;
  title: string;
  status: string;
  rowVersion: number;
}

interface StopRow {
  id: string;
  eventId: string | null;
  reasonCodeId: string | null;
  durationSeconds: number | null;
}

/** a stop the case links to */
interface LinkStop {
  id: string;
  eventId: string | null;
}

interface Recommendation {
  eventId: string;
  trigger: string;
}

interface EntryRow {
  id: string;
  rcaId: string | null;
  rowVersion: number;
}

/** Moves of each target stage (from In Progress; Draft stays as created). */
const PATH: Record<CaseSpec['stage'], readonly string[]> = {
  draft: [],
  analysis: ['Analysis'],
  monitoring: ['Analysis', 'Monitoring'],
  closure_review: ['Analysis', 'Monitoring', 'Closure Review'],
  closed: ['Analysis', 'Monitoring', 'Closure Review'],
};

/** The three longest stops of the case's reason on its unit (else of the unit). */
async function biggestStops(
  ctx: ShowcaseContext,
  spec: CaseSpec,
  session: PersonaSession,
): Promise<StopRow[]> {
  const stops = (
    await session.listAll<StopRow>('/v2/production-events', {
      unitIds: ctx.ids.units.get(spec.unitKey) ?? '',
      physicalTypes: 'downtime',
      from: iso(ctx.window.from),
      to: iso(ctx.window.now),
    })
  ).filter(
    (s) =>
      s.eventId?.startsWith('SC-') &&
      !s.eventId.startsWith('SC-RCA-') &&
      s.durationSeconds,
  );
  const reasonId = ctx.ids.reasons.get(spec.reason);
  const ofReason = stops.filter((s) => s.reasonCodeId === reasonId);
  return (ofReason.length ? ofReason : stops)
    .sort((a, b) => (b.durationSeconds ?? 0) - (a.durationSeconds ?? 0))
    .slice(0, 3);
}

/** The stop the case is opened from: one the trigger recommended (repeat / cost), else the latest. */
async function triggerStop(
  session: PersonaSession,
  spec: CaseSpec,
  stops: LinkStop[],
): Promise<LinkStop> {
  const recommended = await session.listAll<Recommendation>(
    '/v2/rca-recommendations',
    {
      eventIds: stops.map((s) => s.id),
    },
  );
  const hit = recommended.find((r) => r.trigger === spec.openedFromTrigger);
  return stops.find((s) => s.id === hit?.eventId) ?? stops[stops.length - 1];
}

async function createCase(
  ctx: ShowcaseContext,
  spec: CaseSpec,
  session: PersonaSession,
  lead: string,
): Promise<{ id: string; linked: LinkStop[] }> {
  const failures = await failureStopsOf(ctx, session, spec);
  const stops: LinkStop[] = failures.length
    ? failures
    : await biggestStops(ctx, spec, session);
  let id: string;
  let linked: LinkStop[] = [];
  if (spec.openedFromTrigger && stops.length) {
    const from = await triggerStop(session, spec, stops);
    const result = await session.post<{ rca: { id: string } }>(
      `/v2/production-events/${from.id}/rca-link`,
      {
        create: caseBody(ctx, spec, lead),
        reason: `Demo: opened from the ${spec.openedFromTrigger} trigger`,
      },
      `rca open ${spec.key}`,
    );
    id = result.rca.id;
    linked = [from];
  } else {
    id = (
      await session.post<CaseRow>(
        '/v2/rcas',
        caseBody(ctx, spec, lead),
        `rca ${spec.key}`,
      )
    ).id;
  }
  for (const stop of stops.filter((s) => !linked.includes(s))) {
    await session.post(
      `/v2/rcas/${id}/links`,
      {
        linkType: 'event',
        targetId: stop.id,
        reason: 'Demo: same failure mode',
      },
      `rca link ${id} ${stop.id}`,
    );
  }
  return { id, linked: stops };
}

async function addAnalysisAndActions(
  ctx: ShowcaseContext,
  spec: CaseSpec,
  session: PersonaSession,
  id: string,
) {
  const fiveWhy = fiveWhyBody(spec);
  if (fiveWhy)
    await session.call('PUT', `/v2/rcas/${id}/analyses/five-why`, fiveWhy);
  for (const [index, action] of spec.actions.entries()) {
    const row = await session.post<{ id: string; rowVersion: number }>(
      `/v2/rcas/${id}/actions`,
      actionBody(ctx, action, index),
      `rca action ${id} ${index}`,
    );
    if (action.verification && action.verification.toDaysAgo > 0) {
      await session.post(
        `/v2/rca-actions/${row.id}/verify`,
        {},
        `verify ${row.id}`,
        { ifMatch: row.rowVersion },
      );
    }
  }
}

async function move(
  session: PersonaSession,
  id: string,
  body: Record<string, unknown>,
): Promise<CaseRow> {
  const current = await session.get<CaseRow>(`/v2/rcas/${id}`);
  return (
    await session.call<CaseRow>('POST', `/v2/rcas/${id}/transitions`, body, {
      ifMatch: current.rowVersion,
    })
  ).body;
}

/** CA9: the closed case's lesson published by its lead and shared by a manager. */
async function shareLesson(
  ctx: ShowcaseContext,
  sessions: { lead: PersonaSession; manager: PersonaSession },
  spec: CaseSpec,
  id: string,
) {
  const { lead, manager } = sessions;
  const entries = await lead.listAll<EntryRow>('/v2/rca-knowledge', {});
  const entry = entries.find((e) => e.rcaId === id);
  if (!entry) return;
  const published = await lead.post<EntryRow>(
    `/v2/rca-knowledge/${entry.id}/publish`,
    {},
    `publish ${entry.id}`,
    {
      ifMatch: entry.rowVersion,
    },
  );
  await manager.post(
    `/v2/rca-knowledge/${entry.id}/share`,
    {},
    `share ${entry.id}`,
    { ifMatch: published.rowVersion },
  );
  ctx.logger.log(
    `  Demo: lesson of "${spec.title}" shared with the organization`,
  );
}

async function openCase(
  ctx: ShowcaseContext,
  spec: CaseSpec,
  index: number,
): Promise<void> {
  const lead = ctx.persona('reliability', index);
  const session = ctx.session(lead);
  const { id } = await createCase(ctx, spec, session, lead);
  await addAnalysisAndActions(ctx, spec, session, id);
  for (const to of PATH[spec.stage]) {
    await move(
      session,
      id,
      to === 'Closure Review'
        ? { to, residualRisk: spec.residualRisk }
        : { to },
    );
  }
  if (spec.stage !== 'closed') return;
  const manager = ctx.as('managers', index);
  await move(manager, id, {
    to: 'Closed',
    note: 'Demo: effectiveness verified, closure approved',
  });
  await shareLesson(ctx, { lead: session, manager }, spec, id);
}

export async function seedRcaCases(ctx: ShowcaseContext): Promise<void> {
  const existing = await ctx.as('reliability', 0).listAll<CaseRow>('/v2/rcas');
  for (const [index, spec] of caseSpecs(ctx).entries()) {
    if (!ctx.ids.units.has(spec.unitKey)) continue;
    if (existing.some((c) => c.title === spec.title)) {
      ctx.tally.kept('rca cases (demo)');
      continue;
    }
    ctx.tally.add('rca cases (demo)', 1, 0, spec.stage);
    if (!ctx.dryRun) await openCase(ctx, spec, index);
  }
  ctx.logger.log(
    '  Demo: RCA cases seeded through the case workflow (illustrative HDPE stories)',
  );
}
