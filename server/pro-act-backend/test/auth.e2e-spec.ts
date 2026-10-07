import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { TestHelpers } from './test-helpers';

describe('Authentication Endpoints (e2e)', () => {
  let app: INestApplication;
  const testEmail = `test${Date.now()}@proact.com`;

  beforeAll(async () => {
    app = await TestHelpers.setupTestApp();
  });

  afterAll(async () => {
    await TestHelpers.closeApp();
  });

  describe('/auth/register (POST)', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'New Test User',
          email: testEmail,
          password: 'Test@12345',
          role: 'Analyst',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.email).toBe(testEmail);
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should reject registration with invalid email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Test User',
          email: 'invalid-email',
          password: 'Test@12345',
          role: 'Analyst',
        })
        .expect(400);
    });

    it('should reject registration with duplicate email', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Duplicate User',
          email: testEmail,
          password: 'Test@12345',
          role: 'Analyst',
        })
        .expect(400);
    });
  });

  describe('/auth/login (POST)', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'Test@12345',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
          expect(res.body).toHaveProperty('refresh_token');
          expect(res.body).toHaveProperty('user');
          expect(res.body.user.email).toBe(testEmail);
        });
    });

    it('should reject login with invalid password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'WrongPassword',
        })
        .expect(401);
    });

    it('should reject login with non-existent email', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'nonexistent@proact.com',
          password: 'Test@12345',
        })
        .expect(401);
    });
  });

  describe('/auth/refresh (POST)', () => {
    it('should refresh access token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'Test@12345',
        })
        .expect(200);

      const refreshToken = loginRes.body.refresh_token;

      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('access_token');
        });
    });
  });

  describe('/auth/validate-token (POST)', () => {
    it('should validate a valid token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'Test@12345',
        })
        .expect(200);

      const token = loginRes.body.access_token;

      return request(app.getHttpServer())
        .post('/auth/validate-token')
        .send({ token })
        .expect(200)
        .expect((res) => {
          expect(res.body.valid).toBe(true);
        });
    });

    it('should reject invalid token', () => {
      return request(app.getHttpServer())
        .post('/auth/validate-token')
        .send({ token: 'invalid-token' })
        .expect(401);
    });
  });

  describe('/auth/profile (GET)', () => {
    it('should get user profile with valid token', async () => {
      const loginRes = await request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: testEmail,
          password: 'Test@12345',
        })
        .expect(200);

      const token = loginRes.body.access_token;

      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.email).toBe(testEmail);
        });
    });

    it('should reject profile request without token', () => {
      return request(app.getHttpServer()).get('/auth/profile').expect(401);
    });
  });
});

