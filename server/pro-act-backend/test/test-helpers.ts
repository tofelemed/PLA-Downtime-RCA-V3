import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import * as request from 'supertest';

export class TestHelpers {
  static app: INestApplication;
  static authToken: string;
  static testUser = {
    name: 'Test User',
    email: 'test@proact.com',
    password: 'Test@12345',
    role: 'SuperAdmin',
  };

  static async setupTestApp(): Promise<INestApplication> {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleFixture.createNestApplication();
    await app.init();
    this.app = app;
    return app;
  }

  static async closeApp() {
    if (this.app) {
      await this.app.close();
    }
  }

  static async registerAndLogin(app: INestApplication): Promise<string> {
    // Register user
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send(this.testUser)
      .expect((res) => {
        if (res.status !== 201 && res.status !== 400) {
          // 400 if user already exists
          throw new Error(`Unexpected status: ${res.status}`);
        }
      });

    // Login
    const loginResponse = await request(app.getHttpServer())
      .post('/auth/login')
      .send({
        email: this.testUser.email,
        password: this.testUser.password,
      })
      .expect(200);

    this.authToken = loginResponse.body.access_token;
    return this.authToken;
  }

  static getAuthHeader(): object {
    return {
      Authorization: `Bearer ${this.authToken}`,
    };
  }

  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(
      /[xy]/g,
      function (c) {
        const r = (Math.random() * 16) | 0,
          v = c == 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      },
    );
  }

  static async createTestOrganization(
    app: INestApplication,
    token: string,
  ): Promise<any> {
    const response = await request(app.getHttpServer())
      .post('/organizations')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Organization',
        code: `ORG${Date.now()}`,
        description: 'Test organization for automated testing',
      })
      .expect(201);

    return response.body;
  }

  static async createTestTenant(
    app: INestApplication,
    token: string,
    organizationId: string,
  ): Promise<any> {
    const response = await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Tenant',
        code: `TNT${Date.now()}`,
        organizationId,
        description: 'Test tenant for automated testing',
      })
      .expect(201);

    return response.body;
  }

  static async createTestUnit(
    app: INestApplication,
    token: string,
    tenantId: string,
  ): Promise<any> {
    const response = await request(app.getHttpServer())
      .post('/units')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Unit',
        code: `UNIT${Date.now()}`,
        tenantId,
        description: 'Test unit for automated testing',
      })
      .expect(201);

    return response.body;
  }

  static async cleanupTestData(app: INestApplication, token: string) {
    // This would delete test data - implement based on your needs
    // For now, just a placeholder
    console.log('Cleanup test data...');
  }
}
