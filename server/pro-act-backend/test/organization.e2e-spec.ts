import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('OrganizationController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  it('/organizations (POST, GET, PUT, DELETE)', async () => {
    // Create
    const createRes = await request(app.getHttpServer())
      .post('/api/organizations')
      .send({ code: 'ORG2', name: 'E2E Org' })
      .expect(201);
    expect(createRes.body).toHaveProperty('id');
    const orgId = createRes.body.id;

    // Get
    const getRes = await request(app.getHttpServer())
      .get(`/api/organizations/${orgId}`)
      .expect(200);
    expect(getRes.body).toHaveProperty('id', orgId);

    // Update
    const updateRes = await request(app.getHttpServer())
      .put(`/api/organizations/${orgId}`)
      .send({ name: 'E2E Org Updated' })
      .expect(200);
    expect(updateRes.body).toHaveProperty('name', 'E2E Org Updated');

    // Delete
    await request(app.getHttpServer())
      .delete(`/api/organizations/${orgId}`)
      .expect(200);
  });

  afterAll(async () => {
    await app.close();
  });
});
