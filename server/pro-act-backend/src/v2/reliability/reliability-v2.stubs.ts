import { TestingModuleBuilder } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { FailureDictionaryValidator } from '../../reliability/failure-dictionary/failure-dictionary.validator';
import { RELIABILITY_ENTITIES } from '../../reliability/reliability.module';
import { RELIABILITY_V2_SERVICES } from './reliability-v2.module';

/** Database-bound providers of `ReliabilityV2Module` and `ReliabilityModule`. */
const DATABASE_SERVICES = [
  FailureDictionaryValidator,
  ...RELIABILITY_V2_SERVICES,
];

/** Replaces them with empty values so the OpenAPI snapshot builds the module without a connection. */
export function withReliabilityStubs(
  builder: TestingModuleBuilder,
): TestingModuleBuilder {
  const services = DATABASE_SERVICES.reduce<TestingModuleBuilder>(
    (next, service) => next.overrideProvider(service).useValue({}),
    builder,
  );
  return RELIABILITY_ENTITIES.reduce<TestingModuleBuilder>(
    (next, entity) =>
      next.overrideProvider(getRepositoryToken(entity)).useValue({}),
    services,
  );
}
