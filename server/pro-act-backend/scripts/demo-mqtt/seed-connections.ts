/**
 * The two demo MQTT connections (one payload profile each): events and measurements. An existing active
 * MQTT connection with the demo display name is reused; `--connection` / `--measurements-connection`
 * name one explicitly. The subscriber host creates and runs the subscribe job of an active connection
 * on its next sweep, so nothing more is needed to start consuming.
 */
import {
  ConnectionBody,
  eventsConnectionBody,
  measurementsConnectionBody,
} from './demo-mqtt-plan';
import {
  createUnlessDryRun,
  Outcome,
  report,
  SeedContext,
  seedKey,
} from './seed-support';

interface ConnectionRow {
  id: string;
  sourceType: string;
  displayName: string;
  isActive: boolean;
}

export interface ConnectionChoice {
  /** null only in a dry run that would create the connection */
  id: string | null;
  outcome: Outcome;
}

export interface ConnectionOptions {
  brokerUrl: string;
  eventsId: string | null;
  measurementsId: string | null;
}

export interface DemoConnections {
  events: ConnectionChoice;
  measurements: ConnectionChoice;
}

function keep(
  ctx: SeedContext,
  what: string,
  row: ConnectionRow,
  note?: string,
): ConnectionChoice {
  return {
    id: row.id,
    outcome: report(ctx, { what, status: 'kept', id: row.id, note }),
  };
}

async function ensureConnection(
  ctx: SeedContext,
  rows: readonly ConnectionRow[],
  body: ConnectionBody,
  requestedId: string | null,
): Promise<ConnectionChoice> {
  const what = `connection "${body.displayName}"`;
  if (requestedId) {
    const given = rows.find((row) => row.id === requestedId);
    if (!given) {
      throw new Error(
        `connection ${requestedId} is not an active MQTT connection of the tenant`,
      );
    }
    return keep(
      ctx,
      what,
      given,
      `given on the command line as "${given.displayName}"`,
    );
  }
  const found = rows.find((row) => row.displayName === body.displayName);
  if (found) return keep(ctx, what, found);
  const outcome = await createUnlessDryRun(ctx, what, async () => {
    const { body: created } = await ctx.client.write<ConnectionRow>(
      'POST',
      '/api/v2/connections',
      body,
      {
        idempotencyKey: seedKey([
          ctx.tenantId,
          'connection',
          body.displayName,
          JSON.stringify(body.endpointConfig),
        ]),
      },
    );
    return { id: created.id };
  });
  return { id: outcome.id, outcome };
}

export async function ensureConnections(
  ctx: SeedContext,
  options: ConnectionOptions,
): Promise<DemoConnections> {
  const rows = await ctx.client.listAll<ConnectionRow>('/api/v2/connections', {
    sourceType: 'mqtt',
  });
  const active = rows.filter((row) => row.isActive);
  const events = await ensureConnection(
    ctx,
    active,
    eventsConnectionBody(options.brokerUrl),
    options.eventsId,
  );
  const measurements = await ensureConnection(
    ctx,
    active,
    measurementsConnectionBody(options.brokerUrl),
    options.measurementsId,
  );
  return { events, measurements };
}
