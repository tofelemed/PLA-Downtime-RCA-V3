import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Asset } from '../../asset/asset.entity';
import { Product } from '../../product/product.entity';
import { RCACauseCode } from '../../rca-cause-code/rca-cause-code.entity';
import { RCATemplate } from '../../rca-template/rca-template.entity';
import { Unit } from '../../unit/unit.entity';
import { VerificationStatusCode } from '../../verification-status-code/verification-status-code.entity';
import { AssetsV2CommandsService } from '../assets/assets-v2-commands.service';
import { AssetsV2Controller } from '../assets/assets-v2.controller';
import { AssetsV2Service } from '../assets/assets-v2.service';
import { ProductsV2CommandsService } from '../products/products-v2-commands.service';
import { ProductsV2Controller } from '../products/products-v2.controller';
import { ProductsV2Service } from '../products/products-v2.service';
import { RcaCausesV2Controller } from '../rca-settings/rca-causes-v2.controller';
import { RcaCausesV2Service } from '../rca-settings/rca-causes-v2.service';
import { RcaTemplatesV2Controller } from '../rca-settings/rca-templates-v2.controller';
import { RcaTemplatesV2Service } from '../rca-settings/rca-templates-v2.service';
import { VerificationChecklistsV2Controller } from '../rca-settings/verification-checklists-v2.controller';
import { VerificationChecklistsV2Service } from '../rca-settings/verification-checklists-v2.service';
import { UnitsV2CommandsService } from '../units/units-v2-commands.service';
import { UnitsV2Controller } from '../units/units-v2.controller';
import { UnitsV2Service } from '../units/units-v2.service';
import { MasterDataSummaryV2Controller } from './master-data-summary.controller';
import { MasterDataSummaryV2Service } from './master-data-summary.service';

/**
 * Master data on `/api/v2` (owner decision "v2 only", 2026-10-12): units, assets, products, RCA templates,
 * RCA causes, verification checklists and the overview counts. Imported by `V2Module` and included in
 * the v2 OpenAPI document (`openapi-v2.ts`).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Unit,
      Asset,
      Product,
      RCATemplate,
      RCACauseCode,
      VerificationStatusCode,
    ]),
  ],
  controllers: [
    UnitsV2Controller,
    AssetsV2Controller,
    ProductsV2Controller,
    RcaTemplatesV2Controller,
    RcaCausesV2Controller,
    VerificationChecklistsV2Controller,
    MasterDataSummaryV2Controller,
  ],
  providers: [
    UnitsV2Service,
    UnitsV2CommandsService,
    AssetsV2Service,
    AssetsV2CommandsService,
    ProductsV2Service,
    ProductsV2CommandsService,
    RcaTemplatesV2Service,
    RcaCausesV2Service,
    VerificationChecklistsV2Service,
    MasterDataSummaryV2Service,
  ],
})
export class MasterDataV2Module {}
