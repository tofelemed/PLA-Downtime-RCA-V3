import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EvidenceCategoryController } from './evidence-category.controller';
import { EvidenceCategoryService } from './evidence-category.service';
import { EvidenceCategory } from './evidence-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([EvidenceCategory])],
  controllers: [EvidenceCategoryController],
  providers: [EvidenceCategoryService],
  exports: [EvidenceCategoryService],
})
export class EvidenceCategoryModule {} 