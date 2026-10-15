import { TestingModuleBuilder } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CLOSE_ENTITIES, CLOSE_SERVICES } from '../../close/close.module';

/** Replaces the close module's database-bound providers so the OpenAPI snapshot builds without a connection. */
export function withCloseStubs(
  builder: TestingModuleBuilder,
): TestingModuleBuilder {
  const services = CLOSE_SERVICES.reduce<TestingModuleBuilder>(
    (next, service) => next.overrideProvider(service).useValue({}),
    builder,
  );
  return CLOSE_ENTITIES.reduce<TestingModuleBuilder>(
    (next, entity) =>
      next.overrideProvider(getRepositoryToken(entity)).useValue({}),
    services,
  );
}
