import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChangeAnalysis } from './change-analysis.entity';
import { ChangeAnalysisController } from './change-analysis.controller';
import { ChangeAnalysisService } from './change-analysis.service';

@Module({
  imports: [TypeOrmModule.forFeature([ChangeAnalysis])],
  controllers: [ChangeAnalysisController],
  providers: [ChangeAnalysisService],
  exports: [ChangeAnalysisService],
})
export class ChangeAnalysisModule {}

