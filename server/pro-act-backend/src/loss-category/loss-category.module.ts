import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlagsModule } from '../feature-flags/feature-flags.module';
import { LossCategoryController } from './loss-category.controller';
import { LossCategoryService } from './loss-category.service';
import { LossCategory } from './loss-category.entity';

@Module({
  imports: [TypeOrmModule.forFeature([LossCategory]), FeatureFlagsModule],
  controllers: [LossCategoryController],
  providers: [LossCategoryService],
  exports: [LossCategoryService],
})
export class LossCategoryModule {} 