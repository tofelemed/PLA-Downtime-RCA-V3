import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FaultTreeAnalysis } from './fault-tree-analysis.entity';
import { FaultTreeAnalysisController } from './fault-tree-analysis.controller';
import { FaultTreeAnalysisService } from './fault-tree-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([FaultTreeAnalysis])],
  controllers: [FaultTreeAnalysisController],
  providers: [FaultTreeAnalysisService],
  exports: [FaultTreeAnalysisService],
})
export class FaultTreeAnalysisModule {}

