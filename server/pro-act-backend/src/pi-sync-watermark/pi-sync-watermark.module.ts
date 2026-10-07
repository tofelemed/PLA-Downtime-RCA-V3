import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PISyncWatermark } from './pi-sync-watermark.entity';
import { PISyncWatermarkController } from './pi-sync-watermark.controller';
import { PISyncWatermarkService } from './pi-sync-watermark.service';

@Module({
  imports: [TypeOrmModule.forFeature([PISyncWatermark])],
  controllers: [PISyncWatermarkController],
  providers: [PISyncWatermarkService],
  exports: [PISyncWatermarkService],
})
export class PISyncWatermarkModule {}

