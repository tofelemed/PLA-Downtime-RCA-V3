/**
 * Entity counts of the verification: master data, code libraries, rules, calendars, profiles and rates,
 * plans, the accounting workflow, events by kind and coding state, running stops, RCA cases,
 * recommendations, tasks, exports and the MQTT console counters — all read through the API.
 */
import { PersonaSession } from './showcase-client';
import { ShowcaseContext } from './showcase-context';
import { iso } from './showcase-window';

interface EventRow {
  eventId: string | null;
  isOpen: boolean;
  classification: { physicalType: string };
  states: { physical: string; coding: string };
}

function countBy<T>(rows: readonly T[], key: (row: T) => string): string {
  const counts = new Map<string, number>();
  rows.forEach((row) => counts.set(key(row), (counts.get(key(row)) ?? 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => `${k} ${n}`)
    .join(', ');
}

async function libraryCounts(
  ctx: ShowcaseContext,
  session: PersonaSession,
): Promise<void> {
  const parts: string[] = [];
  for (const library of [
    'reason-codes',
    'impact-codes',
    'oee-codes',
    'failure-code-groups',
    'loss-category-defs',
  ]) {
    parts.push(
      `${library} ${(await session.listAll<unknown>(`/v2/${library}`)).length}`,
    );
  }
  const mapping = await session.listAll<unknown>('/v2/code-mapping-rules');
  const rules = await session.listAll<{ state: string }>('/v2/rules', {
    kind: 'coding_default',
    state: 'active',
  });
  ctx.logger.log(
    `  codes (plant): ${parts.join(', ')}; code mapping rules ${mapping.length}; active coding_default rules ${rules.length}`,
  );
}

async function planningCounts(
  ctx: ShowcaseContext,
  session: PersonaSession,
  unitIds: string[],
): Promise<void> {
  let profiles = 0;
  let plans = 0;
  let versions = 0;
  let calendars = 0;
  for (const unitId of unitIds) {
    profiles += (
      await session.listAll<unknown>('/v2/profiles', {
        unitId,
        state: 'approved',
      })
    ).length;
    const unitPlans = await session.listAll<{ currentVersion: number }>(
      '/v2/production-plans',
      { unitId },
    );
    plans += unitPlans.length;
    versions += unitPlans.reduce((sum, p) => sum + p.currentVersion, 0);
    calendars += (
      await session.listAll<unknown>('/v2/calendar-versions', {
        unitId,
        state: 'published',
      })
    ).length;
  }
  const crews = await session.listAll<unknown>('/v2/crews');
  const valuation = await session.listAll<unknown>('/v2/valuation-rates', {
    state: 'approved',
  });
  ctx.logger.log(
    `  planning: published calendars ${calendars}, crews ${crews.length}, approved profiles ${profiles}, plans ${plans} (${versions} versions), approved valuation rates (plant) ${valuation.length}`,
  );
}

async function eventCounts(
  ctx: ShowcaseContext,
  session: PersonaSession,
  unitIds: string[],
): Promise<void> {
  const events: EventRow[] = [];
  for (const unitId of unitIds) {
    events.push(
      ...(await session.listAll<EventRow>('/v2/production-events', {
        unitIds: unitId,
        from: iso(ctx.window.from),
        to: iso(ctx.window.now),
      })),
    );
  }
  const stops = events.filter(
    (e) => e.classification.physicalType === 'downtime',
  );
  ctx.logger.log(
    `  events of the showcase units: ${events.length} (${countBy(events, (e) => e.classification.physicalType)})`,
  );
  ctx.logger.log(
    `  stops by coding state: ${countBy(stops, (e) => e.states.coding)}`,
  );
  const open = await session.listAll<EventRow>('/v2/production-events', {
    isOpen: 'true',
  });
  const running = open.filter((e) => e.states.physical === 'open');
  ctx.logger.log(
    `  running stops in the plant: ${running.length} (${running.map((e) => e.eventId ?? 'no id').join(', ')}); ` +
      `${open.length - running.length} superseded rows also answer isOpen=true`,
  );
}

async function workflowCounts(
  ctx: ShowcaseContext,
  session: PersonaSession,
  unitIds: string[],
): Promise<void> {
  const rows = await session.listAll<{ workflowState: string }>(
    '/v2/period-summaries',
    {
      unitIds,
      from: iso(ctx.window.from),
      to: iso(ctx.window.today),
    },
  );
  ctx.logger.log(
    `  production periods (past days): ${rows.length} (${countBy(rows, (r) => r.workflowState)})`,
  );
}

async function caseCounts(
  ctx: ShowcaseContext,
  session: PersonaSession,
): Promise<void> {
  const cases = await session.listAll<{ status: string }>('/v2/rcas');
  const recommendations = await session.listAll<{ state: string }>(
    '/v2/rca-recommendations',
  );
  const tasks = await session.get<Array<{ status: string }>>(
    `/tasks?tenantId=${ctx.tenantId}`,
  );
  const exports = await session.listAll<{ state: string }>('/v2/exports');
  ctx.logger.log(
    `  RCA cases (plant): ${cases.length} (${countBy(cases, (c) => c.status)})`,
  );
  ctx.logger.log(
    `  RCA trigger recommendations: ${recommendations.length} (${countBy(recommendations, (r) => r.state)})`,
  );
  ctx.logger.log(
    `  tasks (plant): ${tasks.length} (${countBy(tasks, (x) => x.status)}); exports ${exports.length} (${countBy(exports, (e) => e.state)})`,
  );
}

async function mqttCounts(
  ctx: ShowcaseContext,
  session: PersonaSession,
): Promise<void> {
  const connections = await session.listAll<{
    id: string;
    displayName: string;
  }>('/v2/connections');
  for (const connection of connections.filter((c) =>
    c.displayName.startsWith('Demo: MQTT'),
  )) {
    const jobs = await session.listAll<{
      state: string;
      health: { counters?: Record<string, number> } | null;
    }>('/v2/ingestion-jobs', { connectionId: connection.id, state: 'running' });
    const quarantine = await session.listAll<unknown>(
      '/v2/ingestion-exceptions',
      { connectionId: connection.id },
    );
    const counters = jobs[0]?.health?.counters;
    ctx.logger.log(
      `  ${connection.displayName}: ${jobs.length ? 'running' : 'NOT running'}, counters ${counters ? JSON.stringify(counters) : 'n/a'}, exceptions ${quarantine.length}`,
    );
  }
}

export async function verifyCounts(
  ctx: ShowcaseContext,
  session: PersonaSession,
): Promise<void> {
  ctx.logger.log('— verification (read back through the API)');
  if (ctx.scenario.kind === 'partner') {
    const events = await ctx.as('operators', 0).get<{
      total: number;
    }>(`/production-events?tenantId=${ctx.tenantId}&pageSize=1`);
    ctx.logger.log(`  v1 production events in the plant: ${events.total}`);
    return;
  }
  const unitIds = [...ctx.ids.units.values()];
  ctx.logger.log(
    `  master data: units ${ctx.ids.units.size}, assets ${ctx.ids.assets.size}, products ${ctx.ids.products.size}`,
  );
  await libraryCounts(ctx, session);
  await planningCounts(ctx, session, unitIds);
  await workflowCounts(ctx, session, unitIds);
  await eventCounts(ctx, session, unitIds);
  await caseCounts(ctx, session);
  if (ctx.scenario.kind === 'full') await mqttCounts(ctx, session);
}
