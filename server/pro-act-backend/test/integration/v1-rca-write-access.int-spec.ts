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

  it('analysis tools take the plant from the signed-in context, never from the body or query', async () => {
    const admin = (tenantId: string) =>
      signToken(app, { userId: randomUUID(), tenantId, role: 'TenantAdmin' });
    const caseA = (
      (
        await http()
          .post('/api/rcas')
          .set(bearer(admin(world.tenantA)))
          .send({ title: 'Gearbox trip', status: 'Draft', priority: 'High' })
          .expect(201)
      ).body as { id: string }
    ).id;
    const fiveWhy = (tenantId: string) => ({
      tenantId,
      rcaId: caseA,
      problem: 'Gearbox overheated',
      whyLevels: [{ level: 1, question: 'Why?', answer: 'Low oil' }],
      rootCause: 'Lubrication interval too long',
    });
    // a body naming another plant is ignored: the row belongs to the caller's plant
    const created = await http()
      .post('/api/rca-analysis/five-why')
      .set(bearer(admin(world.tenantA)))
      .send(fiveWhy(world.tenantB))
      .expect(201);
    const analysis = created.body as { id: string; tenantId: string };
    expect(analysis.tenantId).toBe(world.tenantA);
    // plant B can neither attach to, read, change nor delete plant A's case work
    await http()
      .post('/api/rca-analysis/five-why')
      .set(bearer(admin(world.tenantB)))
      .send(fiveWhy(world.tenantA))
      .expect(404);
    const read = await http()
      .get(
        `/api/rca-analysis/five-why?rcaId=${caseA}&tenantId=${world.tenantA}`,
      )
      .set(bearer(admin(world.tenantB)))
      .expect(200);
    expect(read.body).toEqual({});
    await http()
      .put(`/api/rca-analysis/five-why/${analysis.id}`)
      .set(bearer(admin(world.tenantB)))
      .send({ rootCause: 'changed by another plant' })
      .expect(404);
    await http()
      .delete(`/api/rca-analysis/five-why/${analysis.id}`)
      .set(bearer(admin(world.tenantB)))
      .expect(404);
    const own = await http()
      .get(`/api/rca-analysis/five-why?rcaId=${caseA}`)
      .set(bearer(admin(world.tenantA)))
      .expect(200);
    expect(own.body).toMatchObject({
      id: analysis.id,
      rootCause: 'Lubrication interval too long',
    });
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
