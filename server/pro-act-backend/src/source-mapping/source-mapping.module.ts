import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AfBinding } from '../af-binding/af-binding.entity';
import { Asset } from '../asset/asset.entity';
import { Unit } from '../unit/unit.entity';
import { LegacyMappingMirror } from './legacy-mapping-mirror';
import { SourceMapping } from './source-mapping.entity';
import { SourceMappingService } from './source-mapping.service';

/** Deterministic source → plant mapping (plan 1.3, ING03). */
@Module({
  imports: [TypeOrmModule.forFeature([SourceMapping, AfBinding, Unit, Asset])],
  providers: [SourceMappingService, LegacyMappingMirror],
  exports: [SourceMappingService, LegacyMappingMirror],
})
export class SourceMappingModule {}
