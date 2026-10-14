import { Type } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AttributeMappingService } from '../../src/attribute-mapping/attribute-mapping.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import { PiEventFrame } from '../../src/integration/pi-frame-ingest.service';
import { PiIntakeBridge } from '../../src/integration/pi-intake-bridge';
import { SourceMappingService } from '../../src/source-mapping/source-mapping.service';
import { A, HOUR } from './support/actuals-world';
import { plus } from './support/accounting-world';
import { ExportWorld } from './support/export-world';

/** The export world with the PI integration (plan 1.6 adapter path) in the application. */
class PiSliceWorld extends ExportWorld {
  protected extraModules(): Array<Type<unknown>> {
    return [IntegrationModule];
  }
}

/**
 * Milestone M1 (plans/README.md, spec §20, C2): one PI event frame → canonical event → shift period → loss
 * line → approved revision → export, end to end on real Postgres with every piece persisted: the D03
 * calendar and shift instances (2.1), an approved profile (2.2) and plan (2.3), the materialized period
 * with its actuals (2.4), the PI frame through the durable intake (1.5/1.6) into a production event, the
 * calculation run with its candidate loss line caused by that event (2.5), reconciliation, submission and
 * approval by a second person (2.8), and the CSV export of the approved revision with its delivery (2.9).
 */
describe('M1 vertical slice: PI event frame → … → approved revision → export', () => {
  const env = new PiSliceWorld();
  const webId = `EF-${randomUUID()}`;

  beforeAll(() => env.start());
  afterAll(() => env.stop());

  const frame = (): PiEventFrame => ({
    WebId: webId,
    Name: 'feed pump trip',
    TemplateName: 'Production Loss',
    StartTime: plus(A, HOUR),
    EndTime: plus(A, 2 * HOUR),
    PrimaryReferencedElement: { WebId: 'EL-M1', Path: '\\\\AF\\HDPE\\unit100' },
  });

  it('carries one PI frame through accounting and approval into an approved export', async () => {
    const { tenantA, unitA1 } = env.world;
    await env.rows(
      `INSERT INTO af_bindings (tenant_id, web_id, local_id, bound_type, is_active) VALUES ($1, 'EL-M1', $2, 'unit', true)`,
      [tenantA, unitA1],
    );
    const ingested = await env.app.get(PiIntakeBridge).ingestFrame(
      {
        context: {
          tenantId: tenantA,
          profile: await env.app
            .get(AttributeMappingService)
            .loadProfile(tenantA, null),
          resolver: await env.app
            .get(SourceMappingService)
            .loadResolver(tenantA, null),
        },
        connectionId: env.connections.pi,
        correlationId: 'm1-slice',
      },
      frame(),
      {},
    );
    expect(ingested.outcome).toBe('created');
    const [event] = await env.rows<{
      id: string;
      unit_id: string;
      physical_type: string;
    }>(
      `SELECT id, unit_id, physical_type FROM production_events WHERE event_id = $1`,
      [webId],
    );
    expect(event).toMatchObject({ unit_id: unitA1, physical_type: 'downtime' });

    await env.settle();
    const draft = await env.view(env.periodA1);
    const candidate = draft.candidates.find((c) => c.causeEventId === event.id);
    expect(candidate).toMatchObject({
      kind: 'availability',
      quantity: '125',
      state: 'proposed',
    });

    const reason = await env.reasonCode('FEED');
    await env
      .saveLines(draft, [
        { action: 'accept', autoKey: candidate?.autoKey },
        {
          action: 'manual',
          sliceId: draft.slices[0].sliceId,
          kind: 'performance',
          quantity: '25',
          missingEvent: true,
          // SME R11: a rate loss without an event cites its rate record
          evidenceType: 'rate_record',
          evidenceRef: 'rate log',
          reasonCodeId: reason,
          reason: 'slow feed',
        },
      ])
      .expect(200);
    await env.submit(await env.view(env.periodA1)).expect(200);
    await env.approve(await env.view(env.periodA1)).expect(200);
    const approved = await env.view(env.periodA1);
    expect(approved.revision.lifecycle).toBe('approved');
    expect(approved.slices[0]).toMatchObject({
      gap: '150',
      attributed: '150',
      residual: '0',
    });

    const jobId = await env.exportDay({ reportType: 'loss_lines' });
    expect(await env.runExports()).toBe(1);
    const file = await env.download(jobId);
    expect(file.status).toBe(200);
    expect(file.hash).toBe((await env.exportJob(jobId)).contentHash);
    const lossLine = ExportWorld.records(file.text).find(
      (r) => r.cause_event_id === event.id,
    );
    expect(lossLine).toMatchObject({
      period_id: env.periodA1,
      revision_id: approved.revision.id,
      calculation_run_id: approved.revision.currentRunId,
      line_source: 'candidate',
      state: 'accepted',
      quantity: '125',
      effective_quantity: '125',
      valuation_status: 'unvalued',
    });

    await env.relay();
    const receipts = await env
      .get(
        'deliveries/reconciliation?from=2020-01-01T00:00:00Z&to=2100-01-01T00:00:00Z',
      )
      .expect(200);
    expect(
      (receipts.body as { items: Array<{ revisionId: string; state: string }> })
        .items,
    ).toEqual([
      expect.objectContaining({
        revisionId: approved.revision.id,
        state: 'delivered',
      }),
    ]);
  });
});
