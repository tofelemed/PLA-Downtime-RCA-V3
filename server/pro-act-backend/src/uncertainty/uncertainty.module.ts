import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PeriodsModule } from '../periods/periods.module';
import { ProfilesModule } from '../profiles/profiles.module';
import { UncertaintyBudget } from './entities/uncertainty-budget.entity';
import { ToleranceAdoptionService } from './tolerance-adoption.service';
import { UncertaintyBudgetsService } from './uncertainty-budgets.service';

/** SME E4: uncertainty budgets per measurement boundary and their adoption as a reconciliation tolerance. */
@Module({
  imports: [
    TypeOrmModule.forFeature([UncertaintyBudget]),
    ProfilesModule,
    PeriodsModule,
  ],
  providers: [UncertaintyBudgetsService, ToleranceAdoptionService],
  exports: [UncertaintyBudgetsService, ToleranceAdoptionService, TypeOrmModule],
})
export class UncertaintyModule {}
