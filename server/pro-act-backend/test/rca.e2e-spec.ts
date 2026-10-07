import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelpers } from './test-helpers';

describe('RCA Endpoints (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let rcaId: string;

  beforeAll(async () => {
    app = await TestHelpers.setupTestApp();
    authToken = await TestHelpers.registerAndLogin(app);
  });

  afterAll(async () => {
    await TestHelpers.closeApp();
  });

  describe('/rcas (POST)', () => {
    it('should create a new RCA', () => {
      return request(app.getHttpServer())
        .post('/rcas')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test RCA Analysis',
          description: 'Root cause analysis for test incident',
          status: 'Open',
          priority: 'High',
          startDate: new Date().toISOString(),
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('Test RCA Analysis');
          rcaId = res.body.id;
        });
    });
  });

  describe('/rcas (GET)', () => {
    it('should get all RCAs', () => {
      return request(app.getHttpServer())
        .get('/rcas')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/rcas/:id (GET)', () => {
    it('should get RCA by id', () => {
      return request(app.getHttpServer())
        .get(`/rcas/${rcaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(rcaId);
        });
    });
  });

  describe('/rcas/:id (PUT)', () => {
    it('should update RCA', () => {
      return request(app.getHttpServer())
        .put(`/rcas/${rcaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'In Progress',
          rootCause: 'Equipment failure due to maintenance issues',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('In Progress');
        });
    });
  });

  describe('/rcas/:id (DELETE)', () => {
    it('should delete RCA', () => {
      return request(app.getHttpServer())
        .delete(`/rcas/${rcaId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });
});

