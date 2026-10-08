import { INestApplication, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { configureHttpApp } from '../common/http/configure-http-app';
import { ProductionEvent } from '../production-event/production-event.entity';
import { ProductionEventModule } from '../production-event/production-event.module';
import { ProductionEventService } from '../production-event/production-event.service';
import { EventCoding } from '../production-event/revisions/event-coding.entity';
import { EventReviewItem } from '../production-event/revisions/event-review-item.entity';
import { EventRevision } from '../production-event/revisions/event-revision.entity';
import { EventRevisionService } from '../production-event/revisions/event-revision.service';
import { Asset } from '../asset/asset.entity';
import { ProductionPlan } from '../production-plan/production-plan.entity';
import { ReasonCode } from '../reason-code/reason-code.entity';
import { Unit } from '../unit/unit.entity';
import { AttributeMappingVersion } from '../attribute-mapping/attribute-mapping-version.entity';
import { AttributeMappingModule } from '../attribute-mapping/attribute-mapping.module';
import { AttributeMappingService } from '../attribute-mapping/attribute-mapping.service';
import { CodeDefaultsService } from '../code-library/code-defaults.service';
import { CodeLibraryCommandService } from '../code-library/code-library-commands.service';
import { CodeLibraryModule } from '../code-library/code-library.module';
import { CodeLibraryService } from '../code-library/code-library.service';
import { CodeMappingRuleService } from '../code-library/code-mapping-rule.service';
import { SourceMapping } from '../source-mapping/source-mapping.entity';
import { SourceMappingModule } from '../source-mapping/source-mapping.module';
import { SourceMappingService } from '../source-mapping/source-mapping.service';
import { BulkCodeService } from '../event-operations/bulk-code.service';
import { BulkJobService } from '../event-operations/bulk-job.service';
import { EventCommandService } from '../event-operations/event-command.service';
import { EventOperationsModule } from '../event-operations/event-operations.module';
import { EventRelation } from '../event-operations/event-relation.entity';
import { buildV2Document } from './openapi-v2';
import { V2Module } from './v2.module';

/** Stands in for the v1 event module (and its RCA/realtime graph): only the document is needed. */
@Module({
  providers: [
    { provide: ProductionEventService, useValue: {} },
    { provide: EventRevisionService, useValue: {} },
  ],
  exports: [ProductionEventService, EventRevisionService],
})
class ProductionEventModuleStub {}

/** Stands in for the plan 1.3 modules (code libraries, mappings): only their controllers' routes matter. */
@Module({
  providers: [
    { provide: CodeLibraryService, useValue: {} },
    { provide: CodeLibraryCommandService, useValue: {} },
    { provide: CodeMappingRuleService, useValue: {} },
    { provide: CodeDefaultsService, useValue: {} },
  ],
  exports: [
    CodeLibraryService,
    CodeLibraryCommandService,
    CodeMappingRuleService,
    CodeDefaultsService,
  ],
})
class CodeLibraryModuleStub {}

@Module({
  providers: [{ provide: SourceMappingService, useValue: {} }],
  exports: [SourceMappingService],
})
class SourceMappingModuleStub {}

@Module({
  providers: [{ provide: AttributeMappingService, useValue: {} }],
  exports: [AttributeMappingService],
})
class AttributeMappingModuleStub {}

/** Stands in for the plan 1.4 event operations (commands, bulk coding, jobs). */
@Module({
  providers: [
    { provide: EventCommandService, useValue: {} },
    { provide: BulkCodeService, useValue: {} },
    { provide: BulkJobService, useValue: {} },
  ],
  exports: [EventCommandService, BulkCodeService, BulkJobService],
})
class EventOperationsModuleStub {}

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
    .overrideProvider(getRepositoryToken(EventRevision))
    .useValue({})
    .overrideProvider(getRepositoryToken(EventCoding))
    .useValue({})
    .overrideProvider(getRepositoryToken(EventReviewItem))
    .useValue({})
    .overrideProvider(getRepositoryToken(SourceMapping))
    .useValue({})
    .overrideProvider(getRepositoryToken(AttributeMappingVersion))
    .useValue({})
    .overrideProvider(getRepositoryToken(EventRelation))
    .useValue({})
    .overrideModule(ProductionEventModule)
    .useModule(ProductionEventModuleStub)
    .overrideModule(CodeLibraryModule)
    .useModule(CodeLibraryModuleStub)
    .overrideModule(SourceMappingModule)
    .useModule(SourceMappingModuleStub)
    .overrideModule(AttributeMappingModule)
    .useModule(AttributeMappingModuleStub)
    .overrideModule(EventOperationsModule)
    .useModule(EventOperationsModuleStub)
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
