import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlag } from './feature-flag.entity';
import { FeatureFlagsService } from './feature-flags.service';
import { PlanDashboardV1WriteGuard } from './plan-dashboard-v1-write.guard';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag])],
  providers: [FeatureFlagsService, PlanDashboardV1WriteGuard],
  exports: [FeatureFlagsService, PlanDashboardV1WriteGuard],
})
export class FeatureFlagsModule {}
