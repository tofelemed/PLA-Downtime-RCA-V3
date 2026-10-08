import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HierarchyMappingController } from './hierarchy-mapping.controller';
import { HierarchyMappingService } from './hierarchy-mapping.service';
import { SourceHierarchyMapping } from './entities/source-hierarchy-mapping.entity';
import { SourceMappingModule } from '../source-mapping/source-mapping.module';

@Module({
  imports: [TypeOrmModule.forFeature([SourceHierarchyMapping]), SourceMappingModule],
  controllers: [HierarchyMappingController],
  providers: [HierarchyMappingService],
  exports: [HierarchyMappingService],
})
export class HierarchyMappingModule {}

