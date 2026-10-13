import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { RCAModule } from '../../src/rca/rca.module';
import { RCAAnalysisMethodologyModule } from '../../src/rca-analysis-methodology/rca-analysis-methodology.module';
import { RCATriggerConfigModule } from '../../src/rca-trigger-config/rca-trigger-config.module';
import { IntegrationHarness } from './harness';
import { EventWorld, seedEventWorld } from './support/seed-event-world';
import { bearer, createIntegrationApp, signToken } from './support/test-app';

/**
 * RCA-02 (EXPERT_REVIEW): the v1 RCA write routes stay for their remaining callers but admit only the
 * roles the v2 RCA routes admit — case work for RCA writers (reliability engineer, manager approver),
 * trigger configuration for manager approvers. An operator or a production engineer can no longer
 * close or delete a case through v1; reads are unchanged.
 */
describe('v1 RCA write access (RCA-02)', () => {
  const harness = new IntegrationHarness();
  let app: INestApplication;
  let world: EventWorld;
  const http = () => request(app.getHttpServer());
  const token = (role: string) =>
    signToken(app, { userId: randomUUID(), tenantId: world.tenantA, role });

  beforeAll(async () => {
    await harness.start();
    world = await seedEventWorld(harness.dataSource);
    app = await createIntegrationApp(harness, {
      modules: [
        RCAModule,
        RCAAnalysisMethodologyModule,
        RCATriggerConfigModule,
      ],
    });
  });

  afterAll(async () => {
    await app?.close();
    await harness.stop();
  });

  const newCase = (role: string) =>
    http()
      .post('/api/rcas')
      .set(bearer(token(role)))
      .send({ title: 'Pump trip', status: 'Draft', priority: 'High' });

  it('an operator or a production engineer may not create, close or delete a case', async () => {
    for (const role of ['Operator', 'Engineer']) {
      const created = await newCase(role).expect(403);
      expect((created.body as { code: string }).code).toBe('FORBIDDEN_ROLE');
    }
    const caseId = (
      (await newCase('TenantAdmin').expect(201)).body as { id: string }
    ).id;
    await http()
      .put(`/api/rcas/${caseId}`)
      .set(bearer(token('Operator')))
      .send({ status: 'Closed' })
      .expect(403);
    await http()
      .delete(`/api/rcas/${caseId}`)
      .set(bearer(token('Operator')))
      .expect(403);
    await http()
      .get(`/api/rcas/${caseId}`)
      .set(bearer(token('Operator')))
      .expect(200);
  });

  it('analysis tools need an RCA writer; trigger configuration needs a manager approver', async () => {
    await http()
      .post('/api/rca-analysis/five-why')
      .set(bearer(token('Operator')))
      .send({})
      .expect(403);
    await http()
      .post('/api/rca-trigger-configs')
      .set(bearer(token('Engineer')))
      .send({})
      .expect(403);
  });
});
