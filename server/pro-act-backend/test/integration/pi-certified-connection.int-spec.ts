import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CredentialEncryptionService } from '../../src/common/services/credential-encryption.service';
import { IntegrationConnectionService } from '../../src/intake/connections/integration-connection.service';
import { IntegrationModule } from '../../src/integration/integration.module';
import { PIConnection } from '../../src/pi-connection/pi-connection.entity';
import { PISyncJob } from '../../src/pi-sync-job/pi-sync-job.entity';
import { PISyncJobModule } from '../../src/pi-sync-job/pi-sync-job.module';
import { PISyncSchedulerService } from '../../src/pi-sync-job/pi-sync-scheduler.service';
import { PISyncWatermark } from '../../src/pi-sync-watermark/pi-sync-watermark.entity';
import { ProductionEventModule } from '../../src/production-event/production-event.module';
import { IntegrationHarness } from './harness';
import { PiJobDriver, usePiTestTimings } from './support/pi-certification';
import { createIntegrationApp } from './support/test-app';
import {
  PiWebApiSimulator,
  SIM_PASSWORD,
  SIM_USERNAME,
} from '../simulators/pi-web-api/pi-web-api-simulator';
import { minutesAgo, simFrame } from '../simulators/pi-web-api/sim-fixtures';

/**
 * Plan 1.6: PI01 connection diagnostics (separate DNS/TLS/auth/version/authz/read checks, batch
 * detection) and the v1 sync jobs moved onto the certified path (v1 jobs crosswalked to leased
 * ingestion jobs, step 5). The v1 `/pi-browser` routes are retired.
 */
describe('PI connection diagnostics and the v1 sync jobs (plan 1.6)', () => {
  const harness = new IntegrationHarness();
  const sim = new PiWebApiSimulator();
  let app: INestApplication;
  let pi: PiJobDriver;
  const tenantId = randomUUID();
  const v1ConnectionId = randomUUID();
  const rows = <T>(sql: string, params: unknown[] = []): Promise<T[]> =>
    harness.dataSource.query<T[]>(sql, params);

  beforeAll(async () => {
    usePiTestTimings();
    await harness.start();
    // DB-05: tenant-owned v1 PI tables reference tenants, so the plant must exist
    const organizationId = randomUUID();
    await rows(
      `INSERT INTO organizations (id, code, name, is_active) VALUES ($1, $2, 'PI org', true)`,
      [organizationId, `PI-${organizationId.slice(0, 8)}`],
    );
    await rows(
      `INSERT INTO tenants (id, code, name, organization_id, is_active) VALUES ($1, $2, 'PI plant', $3, true)`,
      [tenantId, `PI-${tenantId.slice(0, 8)}`, organizationId],
    );
    await sim.start();
    app = await createIntegrationApp(harness, {
      modules: [ProductionEventModule, IntegrationModule, PISyncJobModule],
    });
    pi = new PiJobDriver(app, harness, tenantId);
    await pi.connect(sim);
    await harness.dataSource.getRepository(PIConnection).insert({
      id: v1ConnectionId,
      tenantId,
      connectionName: 'Plant PI (v1)',
      piWebApiUrl: sim.baseUrl,
      username: SIM_USERNAME,
      passwordEncrypted: new CredentialEncryptionService().encrypt(
        SIM_PASSWORD,
      ),
      connectionConfig: JSON.stringify({ databaseWebId: 'DB-HDPE' }),
      isActive: true,
    });
    sim.addFrames(
      [1, 2, 3, 4, 5].map((index) =>
        simFrame({
          webId: `EF-V1-${index}`,
          start: minutesAgo(30 - index),
          end: minutesAgo(29 - index),
          template: 'V1 Loss',
        }),
      ),
    );
  });

  afterEach(() => {
    sim.authRevoked = false;
  });

  afterAll(async () => {
    await harness.dataSource.query(
      `UPDATE ingestion_jobs SET state = 'stopped', lease_owner = NULL WHERE tenant_id = $1`,
      [tenantId],
    );
    await app?.close();
    await sim.close();
    await harness.stop();
  });

  const connections = () => app.get(IntegrationConnectionService);

  describe('PI01 diagnostics', () => {
    it('reports every layer separately and detects the batch controller', async () => {
      const result = await connections().test(pi.context, pi.connectionId);

      expect(result.connected).toBe(true);
      expect(result.diagnostics).toMatchObject({
        dns: { status: 'ok' },
        tls: { status: 'not_applicable' },
        auth: { status: 'ok' },
        version: { status: 'ok', detail: 'PI Web API 1.13.0-sim' },
        authz: { status: 'ok' },
        read: { status: 'ok', detail: '1 AF database(s)' },
      });
      expect(result.capabilities).toEqual({ batch: true });
    });

    it('lost credentials fail the auth check and skip the rest', async () => {
      sim.authRevoked = true;
      const result = await connections().test(pi.context, pi.connectionId);

      expect(result.connected).toBe(false);
      expect(result.message).toMatch(/^auth check failed: PI_AUTH_FAILED/);
      expect(result.diagnostics).toMatchObject({
        dns: { status: 'ok' },
        auth: { status: 'failed' },
        version: { status: 'skipped' },
        read: { status: 'skipped' },
      });
    });

    it('an unresolvable host fails the DNS check', async () => {
      const broken = await connections().create(pi.context, {
        sourceType: 'pi_web_api',
        displayName: 'unresolvable',
        endpointConfig: { piWebApiUrl: 'https://pi-host.invalid/piwebapi' },
      });
      const result = await connections().test(pi.context, broken.id);

      expect(result.connected).toBe(false);
      expect(result.diagnostics).toMatchObject({
        dns: { status: 'failed' },
        tls: { status: 'skipped' },
      });
    });

    it('discovery lists asset servers with their databases', async () => {
      expect(
        await connections().discover(pi.context, pi.connectionId),
      ).toMatchObject({
        metadata: {
          assetServers: [
            {
              webId: 'AS-SIM',
              databases: [{ name: 'HDPE', webId: 'DB-HDPE' }],
            },
          ],
        },
      });
    });
  });

  describe('v1 sync jobs on the certified read', () => {
    it('a v1 sync job is crosswalked to leased ingestion jobs that start at its watermark', async () => {
      const watermark = minutesAgo(26);
      await harness.dataSource.getRepository(PISyncWatermark).insert({
        tenantId,
        syncType: 'database',
        lastSyncMarker: 'DB-HDPE',
        lastSyncTimestamp: watermark,
        syncStatus: 'success',
      });
      const v1Job = await harness.dataSource.getRepository(PISyncJob).save({
        tenantId,
        jobName: 'HDPE losses',
        jobType: 'pi-event-sync',
        isActive: true,
        jobConfig: JSON.stringify({
          templateName: 'V1 Loss',
          intervalMinutes: 1,
        }),
      });

      await app.get(PISyncSchedulerService).runJob(v1Job, true);
      await app.get(PISyncSchedulerService).runJob(v1Job, true);

      const jobs = await rows<{
        id: string;
        scope: Record<string, unknown>;
        cadence: { intervalSeconds: number };
      }>(
        `SELECT id, scope, cadence FROM ingestion_jobs WHERE connection_id = $1 AND state = 'running' ORDER BY created_at`,
        [v1ConnectionId],
      );
      expect(jobs.map((job) => job.scope.mode)).toEqual([
        'window',
        'open_frames',
        'rescan',
        'rescan',
        'inventory',
      ]);
      expect(jobs[0].cadence.intervalSeconds).toBe(60);
      const [link] = await rows<{ ingestion_job_id: string }>(
        `SELECT ingestion_job_id FROM pi_sync_job_links WHERE pi_sync_job_id = $1`,
        [v1Job.id],
      );
      expect(link.ingestion_job_id).toBe(jobs[0].id);

      await pi.runWindow(jobs[0].id);
      const read = await rows<{ source_object_id: string }>(
        `SELECT source_object_id FROM source_objects WHERE connection_id = $1 ORDER BY source_object_id`,
        [v1ConnectionId],
      );
      // the window started at the watermark minus the 15 min overlap: all five frames
      expect(read.map((row) => row.source_object_id)).toEqual([
        'EF-V1-1',
        'EF-V1-2',
        'EF-V1-3',
        'EF-V1-4',
        'EF-V1-5',
      ]);
      const [v1] = await rows<{ status: string }>(
        `SELECT status FROM pi_sync_jobs WHERE id = $1`,
        [v1Job.id],
      );
      expect(v1.status).toBe('success');
    });
  });
});
