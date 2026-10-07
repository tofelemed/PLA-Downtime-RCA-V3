import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HierarchyMappingController } from './hierarchy-mapping.controller';
import { HierarchyMappingService } from './hierarchy-mapping.service';
import { SourceHierarchyMapping } from './entities/source-hierarchy-mapping.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SourceHierarchyMapping])],
  controllers: [HierarchyMappingController],
  providers: [HierarchyMappingService],
  exports: [HierarchyMappingService],
})
export class HierarchyMappingModule {}

