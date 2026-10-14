import { TestingModuleBuilder } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FailureDictionaryEntry } from '../../reliability/entities/failure-dictionary-entry.entity';
import { FailureDictionaryValidator } from '../../reliability/failure-dictionary/failure-dictionary.validator';
import { FailureDictionaryImportV2Service } from './failure-dictionary-import-v2.service';
import { FailureDictionaryV2Service } from './failure-dictionary-v2.service';
import { MicroStopPolicyV2Service } from './micro-stop-policy-v2.service';

/** Providers of `ReliabilityV2Module` that need a database (EntityManager or repositories). */
const DATABASE_SERVICES = [
  FailureDictionaryValidator,
  FailureDictionaryV2Service,
  FailureDictionaryImportV2Service,
  MicroStopPolicyV2Service,
];
const REPOSITORIES = [FailureDictionaryEntry];

/** Replaces them with empty values so the OpenAPI snapshot builds the module without a connection. */
export function withReliabilityStubs(
  builder: TestingModuleBuilder,
): TestingModuleBuilder {
  const services = DATABASE_SERVICES.reduce(
    (next, service) => next.overrideProvider(service).useValue({}),
    builder,
  );
  return REPOSITORIES.reduce(
    (next, entity) =>
      next.overrideProvider(getRepositoryToken(entity)).useValue({}),
    services,
  );
}
