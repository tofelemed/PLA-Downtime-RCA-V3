import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { QueryHistory } from './historian-history.entity';
import { HistorianHistoryController } from './historian-history.controller';
import { HistorianHistoryService } from './historian-history.service';

@Module({
  imports: [TypeOrmModule.forFeature([QueryHistory])],
  controllers: [HistorianHistoryController],
  providers: [HistorianHistoryService],
  exports: [HistorianHistoryService],
})
export class HistorianHistoryModule {}

