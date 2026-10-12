import { Module } from '@nestjs/common';
import { TestingModuleBuilder } from '@nestjs/testing';
import {
  ADMINISTRATION_V2_PROVIDERS,
  AdministrationV2Module,
} from './administration-v2.module';

/** Stands in for the administration services: the OpenAPI snapshot needs only the controllers and DTOs. */
@Module({
  providers: ADMINISTRATION_V2_PROVIDERS.map((provide) => ({
    provide,
    useValue: {},
  })),
  exports: ADMINISTRATION_V2_PROVIDERS,
})
class AdministrationV2ModuleStub {}

/** Replaces `AdministrationV2Module` (and its database-bound imports) for a test without a connection. */
export function withAdministrationStubs(
  builder: TestingModuleBuilder,
): TestingModuleBuilder {
  return builder
    .overrideModule(AdministrationV2Module)
    .useModule(AdministrationV2ModuleStub);
}
