import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FiveWhyAnalysis } from './five-why-analysis.entity';
import { FiveWhyAnalysisController } from './five-why-analysis.controller';
import { FiveWhyAnalysisService } from './five-why-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([FiveWhyAnalysis])],
  controllers: [FiveWhyAnalysisController],
  providers: [FiveWhyAnalysisService],
  exports: [FiveWhyAnalysisService],
})
export class FiveWhyAnalysisModule {}

