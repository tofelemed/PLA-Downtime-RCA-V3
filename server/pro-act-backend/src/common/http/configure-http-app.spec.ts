import { Controller, Get, INestApplication } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import * as request from 'supertest';
import { configureHttpApp, keepAliveTimeoutMs } from './configure-http-app';

@Controller('ping')
class PingController {
  @Get()
  ping(): { ok: boolean } {
    return { ok: true };
  }
}

describe('configureHttpApp server settings (perf audit P14)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PingController],
    }).compile();
    app = configureHttpApp(
      moduleRef.createNestApplication<NestExpressApplication>(),
    );
    await app.init();
  });

  afterAll(() => app.close());

  it('keeps idle connections above a 60 s proxy timeout, headers timeout above that', () => {
    const server = app.getHttpServer() as Server;
    expect(server.keepAliveTimeout).toBe(65_000);
    expect(server.headersTimeout).toBe(66_000);
  });

  it('does not advertise the framework', async () => {
    const res = await request(app.getHttpServer() as Server)
      .get('/api/ping')
      .expect(200);
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('reads the keep-alive timeout from HTTP_KEEP_ALIVE_TIMEOUT_MS', () => {
    expect(keepAliveTimeoutMs({ HTTP_KEEP_ALIVE_TIMEOUT_MS: '75000' })).toBe(
      75_000,
    );
    expect(keepAliveTimeoutMs({ HTTP_KEEP_ALIVE_TIMEOUT_MS: 'x' })).toBe(
      65_000,
    );
  });
});
