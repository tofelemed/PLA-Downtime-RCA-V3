import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { configureHttpApp } from '../common/http/configure-http-app';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { ProductionEventService } from '../production-event/production-event.service';
import { Asset } from '../asset/asset.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { Unit } from '../unit/unit.entity';
import { buildV2Document } from './openapi-v2';
import { V2Module } from './v2.module';

/** Stands in for the v1 event module (and its RCA/realtime graph): only the document is needed. */
@Module({
  providers: [{ provide: ProductionEventService, useValue: {} }],
  exports: [ProductionEventService],
})
class ProductionEventModuleStub {}

/** Committed contract of /api/v2 (plan 0.4 step 8b). Regenerate: `npm run openapi:v2:update`. */
const SNAPSHOT = resolve(__dirname, '..', '..', 'openapi', 'v2.json');

async function generate(): Promise<string> {
  const moduleRef = await Test.createTestingModule({ imports: [V2Module] })
    .overrideProvider(getRepositoryToken(ProductionEvent))
    .useValue({})
    .overrideProvider(getRepositoryToken(Unit))
    .useValue({})
    .overrideProvider(getRepositoryToken(Asset))
    .useValue({})
    .overrideProvider(getRepositoryToken(ReasonCode))
    .useValue({})
    .overrideProvider(getRepositoryToken(ProductionPlan))
    .useValue({})
    .overrideModule(ProductionEventModule)
    .useModule(ProductionEventModuleStub)
    .compile();
  const app: INestApplication = configureHttpApp(
    moduleRef.createNestApplication(),
  );
  await app.init();
  try {
    return `${JSON.stringify(buildV2Document(app), null, 2)}\n`;
  } finally {
    await app.close();
  }
}

describe('OpenAPI v2 snapshot', () => {
  it('matches openapi/v2.json (public API contract)', async () => {
    const generated = await generate();
    if (process.env.UPDATE_OPENAPI === '1') {
      writeFileSync(SNAPSHOT, generated);
    }
    if (!existsSync(SNAPSHOT)) {
      throw new Error(`Missing ${SNAPSHOT}; run npm run openapi:v2:update`);
    }
    const committed = readFileSync(SNAPSHOT, 'utf8').replace(/\r\n/g, '\n');
    expect(generated).toBe(committed);
  });
});
