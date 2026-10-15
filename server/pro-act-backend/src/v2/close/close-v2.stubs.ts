import { TestingModuleBuilder } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { CLOSE_ENTITIES, CLOSE_SERVICES } from '../../close/close.module';
import {
  NOTIFICATION_ENTITIES,
  NOTIFICATION_SERVICES,
} from '../../notifications/notifications.module';

/** Replaces the close and notification modules' database-bound providers so the OpenAPI snapshot builds without a connection. */
export function withCloseStubs(
  builder: TestingModuleBuilder,
): TestingModuleBuilder {
  const services = [
    ...CLOSE_SERVICES,
    ...NOTIFICATION_SERVICES,
  ].reduce<TestingModuleBuilder>(
    (next, service) => next.overrideProvider(service).useValue({}),
    builder,
  );
  return [
    ...CLOSE_ENTITIES,
    ...NOTIFICATION_ENTITIES,
  ].reduce<TestingModuleBuilder>(
    (next, entity) =>
      next.overrideProvider(getRepositoryToken(entity)).useValue({}),
    services,
  );
}
