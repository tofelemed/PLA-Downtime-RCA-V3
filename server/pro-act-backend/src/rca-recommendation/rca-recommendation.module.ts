import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RCARecommendation } from './rca-recommendation.entity';
import { RCARecommendationService } from './rca-recommendation.service';
import { RCARecommendationController } from './rca-recommendation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RCARecommendation])],
  providers: [RCARecommendationService],
  controllers: [RCARecommendationController],
  exports: [RCARecommendationService],
})
export class RCARecommendationModule {} 