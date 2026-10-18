/**
 * Guide lesson 9 / E2E §10–12, configured by the integration administrator (Mina): the MQTT measurements
 * connection, the state and tonne-counter signals (valid from the commissioning instant), the unit-state
 * mapping with its heartbeat, and the running subscription. The subscriber host creates the subscribe job
 * of an active connection on its next sweep; this step waits for it and starts it when it is not running.
 */
import { setTimeout as sleep } from 'timers/promises';
import {
  brokerSettings,
  CONNECTION_NAME,
  connectionBody,
  SIGNALS,
  STATE_MAPPING,
} from './train-catalog-setup';
import { known, TrainContext } from './train-context';

interface ConnectionRow {
  id: string;
  displayName: string;
  isActive: boolean;
}

interface SignalRow {
  id: string;
  sourceKey: string;
}

interface JobRow {
  id: string;
  state: string;
}

const JOB_WAIT_SECONDS = 60;

async function ensureConnection(ctx: TrainContext): Promise<void> {
  const mina = ctx.as('mina');
  const rows = await mina.listAll<ConnectionRow>('/v2/connections', {
    sourceType: 'mqtt',
  });
  const found = rows.find((row) => row.displayName === CONNECTION_NAME);
  if (found) {
    ctx.ids.connectionId = found.id;
    ctx.tally.kept('mqtt connection');
    return;
  }
  const broker = brokerSettings();
  ctx.tally.add('mqtt connection', 1, 0, broker.url);
  if (ctx.dryRun) return;
  const created = await mina.post<ConnectionRow>(
    '/v2/connections',
    connectionBody(broker),
    `connection ${CONNECTION_NAME}`,
  );
  ctx.ids.connectionId = created.id;
}

async function ensureSignals(ctx: TrainContext): Promise<void> {
  const connectionId = ctx.ids.connectionId;
  if (!known(ctx, connectionId, 'MQTT connection')) return;
  const mina = ctx.as('mina');
  const rows = await mina.listAll<SignalRow>('/v2/signals', { connectionId });
  for (const spec of SIGNALS) {
    const found = rows.find((row) => row.sourceKey === spec.sourceKey);
    if (found) {
      ctx.ids.signals.set(spec.sourceKey, found.id);
      ctx.tally.kept('signals');
      continue;
    }
    ctx.tally.created('signals');
    if (ctx.dryRun) continue;
    const body = {
      ...spec,
      qualityPolicy: { ...spec.qualityPolicy },
      connectionId,
      unitId: ctx.ids.unitId,
    };
    const created = await mina.post<SignalRow>(
      '/v2/signals',
      body,
      `signal ${spec.sourceKey}`,
    );
    ctx.ids.signals.set(spec.sourceKey, created.id);
  }
}

async function ensureStateMapping(ctx: TrainContext): Promise<void> {
  const signalId = ctx.ids.signals.get('EXT1-State');
  if (!known(ctx, signalId, 'signal EXT1-State')) return;
  const mina = ctx.as('mina');
  const unitId = ctx.ids.unitId;
  const versions = await mina.listAll<{ signalId: string }>(
    '/v2/unit-state-mappings',
    { unitId },
  );
  if (versions.some((v) => v.signalId === signalId)) {
    ctx.tally.kept('unit state mapping');
    return;
  }
  ctx.tally.created('unit state mapping');
  if (ctx.dryRun) return;
  const body = {
    ...STATE_MAPPING,
    rules: STATE_MAPPING.rules.map((r) => ({ ...r })),
    unitId,
    signalId,
  };
  await mina.post('/v2/unit-state-mappings', body, 'state mapping Extruder1');
}

async function subscribeJob(
  ctx: TrainContext,
  connectionId: string,
): Promise<JobRow | null> {
  for (let second = 0; second < JOB_WAIT_SECONDS; second += 2) {
    const jobs = await ctx
      .as('mina')
      .listAll<JobRow>('/v2/ingestion-jobs', { connectionId });
    if (jobs.length > 0) return jobs[0];
    if (ctx.dryRun) return null;
    await sleep(2000);
  }
  return null;
}

async function ensureSubscription(ctx: TrainContext): Promise<void> {
  const connectionId = ctx.ids.connectionId;
  if (!known(ctx, connectionId, 'MQTT connection')) return;
  const job = await subscribeJob(ctx, connectionId);
  if (!job) {
    ctx.tally.add(
      'subscription',
      0,
      0,
      'no subscribe job yet: is the worker running?',
    );
    return;
  }
  if (job.state === 'running' || job.state === 'draining') {
    ctx.tally.kept('subscription');
    return;
  }
  const action = job.state === 'paused' ? 'resume' : 'start';
  ctx.tally.add('subscription', 1, 0, `${action} from ${job.state}`);
  if (ctx.dryRun) return;
  await ctx
    .as('mina')
    .post(
      `/v2/ingestion-jobs/${job.id}/${action}`,
      { reason: 'Commissioning of the Extruder1 measurement intake' },
      `${action} job ${job.id}`,
    );
}

export async function seedIntegration(ctx: TrainContext): Promise<void> {
  if (!known(ctx, ctx.ids.unitId, 'unit Extruder1')) return;
  await ensureConnection(ctx);
  await ensureSignals(ctx);
  await ensureStateMapping(ctx);
  await ensureSubscription(ctx);
}
