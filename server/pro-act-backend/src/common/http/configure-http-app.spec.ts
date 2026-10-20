import { Controller, Get, INestApplication, Req } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { Server } from 'http';
import * as request from 'supertest';
import {
  configureHttpApp,
  keepAliveTimeoutMs,
  trustProxySetting,
} from './configure-http-app';

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

describe('trust proxy (perf audit P11)', () => {
  it('parses TRUST_PROXY as boolean, hop count or address list; unset keeps the default', () => {
    expect(trustProxySetting({})).toBeUndefined();
    expect(trustProxySetting({ TRUST_PROXY: ' ' })).toBeUndefined();
    expect(trustProxySetting({ TRUST_PROXY: 'true' })).toBe(true);
    expect(trustProxySetting({ TRUST_PROXY: 'false' })).toBe(false);
    expect(trustProxySetting({ TRUST_PROXY: '1' })).toBe(1);
    expect(trustProxySetting({ TRUST_PROXY: 'loopback, uniquelocal' })).toBe(
      'loopback, uniquelocal',
    );
  });

  it('takes the client address from X-Forwarded-For only when the proxy is trusted', async () => {
    @Controller('whoami')
    class WhoAmIController {
      @Get()
      ip(@Req() req: { ip?: string }): { ip?: string } {
        return { ip: req.ip };
      }
    }
    const ipSeen = async (trustProxy?: string) => {
      const previous = process.env.TRUST_PROXY;
      if (trustProxy) process.env.TRUST_PROXY = trustProxy;
      else delete process.env.TRUST_PROXY;
      const moduleRef = await Test.createTestingModule({
        controllers: [WhoAmIController],
      }).compile();
      const app = configureHttpApp(
        moduleRef.createNestApplication<NestExpressApplication>(),
      );
      await app.init();
      try {
        const res = await request(app.getHttpServer())
          .get('/api/whoami')
          .set('X-Forwarded-For', '203.0.113.7')
          .expect(200);
        return (res.body as { ip?: string }).ip;
      } finally {
        await app.close();
        if (previous === undefined) delete process.env.TRUST_PROXY;
        else process.env.TRUST_PROXY = previous;
      }
    };
    expect(await ipSeen()).not.toBe('203.0.113.7');
    expect(await ipSeen('loopback')).toBe('203.0.113.7');
  });
});
