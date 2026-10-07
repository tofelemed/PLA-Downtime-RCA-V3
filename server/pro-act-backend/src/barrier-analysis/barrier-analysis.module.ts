import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BarrierAnalysis } from './barrier-analysis.entity';
import { BarrierAnalysisController } from './barrier-analysis.controller';
import { BarrierAnalysisService } from './barrier-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([BarrierAnalysis])],
  controllers: [BarrierAnalysisController],
  providers: [BarrierAnalysisService],
  exports: [BarrierAnalysisService],
})
export class BarrierAnalysisModule {}

