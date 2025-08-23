import { PartialType } from '@nestjs/swagger';
import { CreateRCARecommendationDto } from './create-rca-recommendation.dto';

export class UpdateRCARecommendationDto extends PartialType(CreateRCARecommendationDto) {} 