import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCAAnalysisMethodologyService } from './rca-analysis-methodology.service';
import { RCAAnalysisMethodologyController } from './rca-analysis-methodology.controller';
import { RcaFiveWhyAnalysis } from './entities/five-why-analysis.entity';
import { RcaFishboneDiagram } from './entities/fishbone-diagram.entity';
import { RcaFmeaAnalysis } from './entities/fmea-analysis.entity';
import { RcaFaultTreeAnalysis } from './entities/fault-tree-analysis.entity';
import { RcaBarrierAnalysis } from './entities/barrier-analysis.entity';
import { RcaChangeAnalysis } from './entities/change-analysis.entity';
import { RCA } from '../rca/rca.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      RcaFiveWhyAnalysis,
      RcaFishboneDiagram,
      RcaFmeaAnalysis,
      RcaFaultTreeAnalysis,
      RcaBarrierAnalysis,
      RcaChangeAnalysis,
      RCA,
    ]),
  ],
  controllers: [RCAAnalysisMethodologyController],
  providers: [RCAAnalysisMethodologyService],
  exports: [RCAAnalysisMethodologyService],
})
export class RCAAnalysisMethodologyModule {}
