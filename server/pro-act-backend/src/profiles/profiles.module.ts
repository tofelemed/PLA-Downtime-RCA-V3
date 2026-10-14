import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductionProfile } from './entities/production-profile.entity';
import { RateImport } from './entities/rate-import.entity';
import { GradeTransitionStandard } from './entities/transition-standard.entity';
import { UnitProductRate } from './entities/unit-product-rate.entity';
import { ValuationRate } from './entities/valuation-rate.entity';
import { ProfileReferences } from './profile-references';
import { ProfileResolutionService } from './profile-resolution.service';
import { ProfilesService } from './profiles.service';
import { RateImportProcessor } from './rate-import.processor';
import { RateImportRunner } from './rate-import.runner';
import { RateImportsService } from './rate-imports.service';
import { RatesService } from './rates.service';
import { TransitionStandardsService } from './transition-standards.service';
import { ValuationRatesService } from './valuation-rates.service';

/**
 * Production profiles and rates of plan 2.2 (PLAN01, PLAN06, VAL01): versioned profiles, unit-product
 * rates, valuation rates and the grade-transition matrix (LA-08) with approval / supersede / no-overlap, profile resolution for 2.3–2.7, and
 * budget / forecast / MPC imports (worker job in worker/all processes).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProductionProfile,
      UnitProductRate,
      ValuationRate,
      RateImport,
      GradeTransitionStandard,
    ]),
  ],
  providers: [
    ProfileReferences,
    ProfilesService,
    RatesService,
    ValuationRatesService,
    TransitionStandardsService,
    ProfileResolutionService,
    RateImportsService,
    RateImportRunner,
    RateImportProcessor,
  ],
  exports: [
    ProfileReferences,
    ProfilesService,
    RatesService,
    ValuationRatesService,
    TransitionStandardsService,
    ProfileResolutionService,
    RateImportsService,
    RateImportRunner,
  ],
})
export class ProfilesModule {}
