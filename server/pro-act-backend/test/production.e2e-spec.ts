import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TestHelpers } from './test-helpers';

describe('Production Endpoints (e2e)', () => {
  let app: INestApplication;
  let authToken: string;
  let productId: string;
  let planId: string;

  beforeAll(async () => {
    app = await TestHelpers.setupTestApp();
    authToken = await TestHelpers.registerAndLogin(app);
  });

  afterAll(async () => {
    await TestHelpers.closeApp();
  });

  describe('/products (POST)', () => {
    it('should create a new product', () => {
      return request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Product',
          code: `PROD${Date.now()}`,
          description: 'Test product description',
          uom: 'kg',
          standardRate: 100,
          isActive: true,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          productId = res.body.id;
        });
    });
  });

  describe('/production-plans (POST)', () => {
    it('should create a production plan', () => {
      return request(app.getHttpServer())
        .post('/production-plans')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          planName: 'Test Production Plan',
          startDate: new Date().toISOString(),
          endDate: new Date(Date.now() + 86400000).toISOString(),
          targetQuantity: 1000,
          status: 'Planned',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          planId = res.body.id;
        });
    });
  });

  describe('/production-events (POST)', () => {
    it('should create a production event', () => {
      return request(app.getHttpServer())
        .post('/production-events')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          eventType: 'Downtime',
          eventName: 'Equipment Breakdown',
          startTime: new Date().toISOString(),
          status: 'Open',
          severity: 'High',
          description: 'Test production event',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
        });
    });
  });
});
