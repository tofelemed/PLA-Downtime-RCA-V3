import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { IntegrationModule } from '../../../src/integration/integration.module';
import { ProductionEventModule } from '../../../src/production-event/production-event.module';
import { V2Module } from '../../../src/v2/v2.module';
import { PiWebApiSimulator } from '../../simulators/pi-web-api/pi-web-api-simulator';
import { IntegrationHarness } from '../harness';
import { PiJobDriver, usePiTestTimings } from './pi-certification';
import { EventWorld, seedEventWorld } from './seed-event-world';
import { bearer, createIntegrationApp, signToken } from './test-app';

export const MINUTE = 60_000;

/** The v2 preview answer as the plan 1.7 tests read it. */
export interface PreviewBody {
  engine: string;
  result: {
    quantity: string | null;
    method: { name: string; timebase: string | null };
    coverage: { ratio: string; missingSeconds: number };
    exceptions: Array<{ code: string }>;
  };
  samples: Array<{
    observedAt: string;
    value: string | null;
    revisions: number;
  }>;
  piTotals: Array<{ total: string | null; timebase: string }>;
}

/**
 * Shared world of the plan 1.7 integration specs: the PI simulator with three streams starting 40 min
 * ago (a 120 t/h rate every 5 min; a totaliser rolling over 995 → 5 with a system-state value; a counter
 * dropping 1000 → 10) and three signals bound to them through `POST /api/v2/signals`. Test data only.
 */
export class PiSignalWorld {
  readonly harness = new IntegrationHarness();
  readonly sim = new PiWebApiSimulator();
  readonly signals: Record<'rate' | 'counter' | 'reset', string> = {
    rate: '',
    counter: '',
    reset: '',
  };
  readonly base = Math.floor(Date.now() / MINUTE) * MINUTE - 40 * MINUTE;
  app!: INestApplication;
  world!: EventWorld;
  pi!: PiJobDriver;
  admin = '';

  async start(): Promise<void> {
    usePiTestTimings();
    await this.harness.start();
    await this.sim.start();
    this.world = await seedEventWorld(this.harness.dataSource);
    this.app = await createIntegrationApp(this.harness, {
      modules: [ProductionEventModule, IntegrationModule, V2Module],
    });
    this.pi = new PiJobDriver(this.app, this.harness, this.world.tenantA);
    await this.pi.connect(this.sim);
    this.admin = signToken(this.app, {
      userId: randomUUID(),
      tenantId: this.world.tenantA,
      role: 'TenantAdmin',
    });
    this.seedStreams();
    await this.createSignals();
  }

  async stop(): Promise<void> {
    await this.harness.dataSource.query(
      `UPDATE ingestion_jobs SET state = 'stopped', lease_owner = NULL WHERE tenant_id = $1`,
      [this.world.tenantA],
    );
    await this.app?.close();
    await this.sim.close();
    await this.harness.stop();
  }

  /** ISO time `minutes` after the stream start. */
  at(minutes: number): string {
    return new Date(this.base + minutes * MINUTE).toISOString();
  }

  http() {
    return request(this.app.getHttpServer());
  }

  post(path: string, body: object, token = this.admin): request.Test {
    return this.http()
      .post(`/api/v2/${path}`)
      .set(bearer(token))
      .set('Idempotency-Key', randomUUID())
      .send(body);
  }

  async preview(
    key: keyof PiSignalWorld['signals'],
    from: number,
    to: number,
  ): Promise<PreviewBody> {
    const response = await this.post(`signals/${this.signals[key]}/preview`, {
      from: this.at(from),
      to: this.at(to),
    }).expect(200);
    return response.body as PreviewBody;
  }

  rows<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    return this.harness.dataSource.query<T[]>(sql, params);
  }

  private seedStreams(): void {
    const value = (minute: number, v: unknown, unit: string) => ({
      Timestamp: this.at(minute),
      Value: v,
      UnitsAbbreviation: unit,
      Good: true,
    });
    const timeout = { Name: 'I/O Timeout', Value: 246, IsSystem: true };
    this.sim.streams.add(
      'PT-RATE',
      [0, 5, 10, 15, 20, 25, 30].map((minute) => value(minute, 120, 't/h')),
    );
    this.sim.streams.add('PT-CNT', [
      value(0, 995, 't'),
      value(6, 5, 't'),
      value(12, 25, 't'),
      { ...value(14, timeout, 't'), Good: false },
    ]);
    this.sim.streams.add('PT-RESET', [value(0, 1000, 't'), value(10, 10, 't')]);
  }

  private async createSignals(): Promise<void> {
    const common = {
      connectionId: this.pi.connectionId,
      unitId: this.world.unitA1,
      maxGapSeconds: 900,
      canonicalUom: 't',
    };
    const create = async (
      key: keyof PiSignalWorld['signals'],
      body: object,
    ) => {
      const response = await this.post('signals', {
        ...common,
        ...body,
      }).expect(201);
      this.signals[key] = (response.body as { id: string }).id;
    };
    await create('rate', {
      name: 'Unit100 feed rate',
      sourceKey: 'PT-RATE',
      semanticType: 'rate',
      canonicalUom: 't/h',
      rateTimebase: 'h',
    });
    await create('counter', {
      name: 'Unit100 totaliser',
      sourceKey: 'PT-CNT',
      semanticType: 'counter',
      resetPolicy: 'detect_drop',
      rolloverModulus: '1000',
      rateTimebase: 'h',
      expectedMax: '5000',
    });
    await create('reset', {
      name: 'Unit100 counter without modulus',
      sourceKey: 'PT-RESET',
      semanticType: 'counter',
      resetPolicy: 'detect_drop',
    });
  }
}
