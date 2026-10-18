import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelpers } from './test-helpers';

describe('Organizations Endpoints (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let createdOrgId: string;

  beforeAll(async () => {
    app = await TestHelpers.setupTestApp();
    authToken = await TestHelpers.registerAndLogin(app);
  });

  afterAll(async () => {
    await TestHelpers.closeApp();
  });

  describe('/organizations (POST)', () => {
    it('should create a new organization', () => {
      return request(app.getHttpServer())
        .post('/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Organization',
          code: `ORG${Date.now()}`,
          description: 'Test organization description',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('Test Organization');
          createdOrgId = res.body.id;
        });
    });

    it('should reject creation without auth token', () => {
      return request(app.getHttpServer())
        .post('/organizations')
        .send({
          name: 'Unauthorized Org',
          code: `ORG${Date.now()}`,
        })
        .expect(401);
    });
  });

  describe('/organizations (GET)', () => {
    it('should get all organizations', () => {
      return request(app.getHttpServer())
        .get('/organizations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });
  });

  describe('/organizations/:id (GET)', () => {
    it('should get organization by id', () => {
      return request(app.getHttpServer())
        .get(`/organizations/${createdOrgId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(createdOrgId);
        });
    });

    it('should return 404 for non-existent organization', () => {
      const fakeId = TestHelpers.generateUUID();
      return request(app.getHttpServer())
        .get(`/organizations/${fakeId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('/organizations/:id (PUT)', () => {
    it('should update organization', () => {
      return request(app.getHttpServer())
        .put(`/organizations/${createdOrgId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          description: 'Updated description',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.description).toBe('Updated description');
        });
    });
  });

  describe('/organizations/:id (DELETE)', () => {
    it('should delete organization', () => {
      return request(app.getHttpServer())
        .delete(`/organizations/${createdOrgId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);
    });
  });
});
