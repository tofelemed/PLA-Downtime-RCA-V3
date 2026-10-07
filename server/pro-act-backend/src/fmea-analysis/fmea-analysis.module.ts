import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FMEAAnalysis } from './fmea-analysis.entity';
import { FMEAAnalysisController } from './fmea-analysis.controller';
import { FMEAAnalysisService } from './fmea-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([FMEAAnalysis])],
  controllers: [FMEAAnalysisController],
  providers: [FMEAAnalysisService],
  exports: [FMEAAnalysisService],
})
export class FMEAAnalysisModule {}

