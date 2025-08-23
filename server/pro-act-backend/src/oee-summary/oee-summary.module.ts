import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OEESummaryController } from './oee-summary.controller';
import { OEESummaryService } from './oee-summary.service';
import { OEESummary } from './oee-summary.entity';

@Module({
  imports: [TypeOrmModule.forFeature([OEESummary])],
  controllers: [OEESummaryController],
  providers: [OEESummaryService],
  exports: [OEESummaryService],
})
export class OEESummaryModule {} 