import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCAAnalysisConfig } from './rca-analysis-config.entity';
import { RCAAnalysisConfigController } from './rca-analysis-config.controller';
import { RCAAnalysisConfigService } from './rca-analysis-config.service';

@Module({
  imports: [TypeOrmModule.forFeature([RCAAnalysisConfig])],
  controllers: [RCAAnalysisConfigController],
  providers: [RCAAnalysisConfigService],
  exports: [RCAAnalysisConfigService],
})
export class RCAAnalysisConfigModule {}

