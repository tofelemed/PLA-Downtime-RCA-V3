import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HistorianTag } from './historian-tag.entity';
import { HistorianTagController } from './historian-tag.controller';
import { HistorianTagService } from './historian-tag.service';

@Module({
  imports: [TypeOrmModule.forFeature([HistorianTag])],
  controllers: [HistorianTagController],
  providers: [HistorianTagService],
  exports: [HistorianTagService],
})
export class HistorianTagModule {}

