import { TestingModuleBuilder } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RCACauseCode } from '../../rca-cause-code/rca-cause-code.entity';
import { RCATemplate } from '../../rca-template/rca-template.entity';
import { VerificationStatusCode } from '../../verification-status-code/verification-status-code.entity';
import { AssetsV2CommandsService } from '../assets/assets-v2-commands.service';
import { ProductsV2CommandsService } from '../products/products-v2-commands.service';
import { RcaCausesV2Service } from '../rca-settings/rca-causes-v2.service';
import { RcaTemplatesV2Service } from '../rca-settings/rca-templates-v2.service';
import { VerificationChecklistsV2Service } from '../rca-settings/verification-checklists-v2.service';
import { UnitsV2CommandsService } from '../units/units-v2-commands.service';
import { MasterDataSummaryV2Service } from './master-data-summary.service';

/** Services of `MasterDataV2Module` that need a database (EntityManager or repositories of its own). */
const DATABASE_SERVICES = [
  UnitsV2CommandsService,
  AssetsV2CommandsService,
  ProductsV2CommandsService,
  RcaTemplatesV2Service,
  RcaCausesV2Service,
  VerificationChecklistsV2Service,
  MasterDataSummaryV2Service,
];
const REPOSITORIES = [RCATemplate, RCACauseCode, VerificationStatusCode];

/**
 * Replaces the database-bound providers of `MasterDataV2Module` with empty values, so a test can build the
 * module without a connection (the OpenAPI snapshot needs only the controllers and DTOs).
 */
export function withMasterDataStubs(
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
