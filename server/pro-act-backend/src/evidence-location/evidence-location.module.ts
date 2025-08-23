import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenceLocationController } from './evidence-location.controller';
import { EvidenceLocationService } from './evidence-location.service';
import { EvidenceLocation } from './evidence-location.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EvidenceLocation])],
  controllers: [EvidenceLocationController],
  providers: [EvidenceLocationService],
  exports: [EvidenceLocationService],
})
export class EvidenceLocationModule {} 