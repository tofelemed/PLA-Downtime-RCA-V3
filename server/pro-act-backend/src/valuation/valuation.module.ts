import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountingPolicy } from '../periods/entities/accounting-policy.entity';
import { DemandStatusesService } from './demand-statuses.service';
import { DemandStatus } from './entities/demand-status.entity';
import { FxRate } from './entities/fx-rate.entity';
import { LossLineValuation } from './entities/loss-line-valuation.entity';
import { PeriodValuationTotal } from './entities/period-valuation-total.entity';
import { FinanceTextCorrectionsService } from './finance-text-corrections.service';
import { FxRatesService } from './fx-rates.service';
import { ValuationPoliciesService } from './valuation-policies.service';

/**
 * Valuation of plan 2.6 (VAL01–VAL03, D08): the approved FX rate table and the `valuation_basis` policy
 * versions. The valuation itself runs inside the 2.5 calculation run (`run-valuation.ts`) from a frozen
 * context, and the reviewed / approved valuation is derived in 2.8 (`reviewed-valuation.ts`).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      FxRate,
      DemandStatus,
      LossLineValuation,
      PeriodValuationTotal,
      AccountingPolicy,
    ]),
  ],
  providers: [
    FxRatesService,
    ValuationPoliciesService,
    DemandStatusesService,
    FinanceTextCorrectionsService,
  ],
  exports: [
    FxRatesService,
    ValuationPoliciesService,
    DemandStatusesService,
    FinanceTextCorrectionsService,
  ],
})
export class ValuationModule {}
