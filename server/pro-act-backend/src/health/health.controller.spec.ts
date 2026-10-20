import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import * as request from 'supertest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('GET /health (perf audit P13)', () => {
  let app: INestApplication;
  let healthy = true;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            check: () =>
              Promise.resolve({
                status: healthy ? 'healthy' : 'unhealthy',
                database: healthy ? 'connected' : 'disconnected',
              }),
          },
        },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(() => app.close());

  it('answers 200 while the database answers', async () => {
    healthy = true;
    const res = await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(200);
    expect(res.body).toMatchObject({ status: 'healthy' });
  });

  it('answers 503 with the same body when the database does not, so probes see it', async () => {
    healthy = false;
    const res = await request(app.getHttpServer() as Server)
      .get('/health')
      .expect(503);
    expect(res.body).toMatchObject({
      status: 'unhealthy',
      database: 'disconnected',
    });
  });
});
