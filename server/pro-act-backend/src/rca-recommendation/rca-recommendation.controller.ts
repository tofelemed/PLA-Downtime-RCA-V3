import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RCARecommendationService } from './rca-recommendation.service';
import { RCARecommendation } from './rca-recommendation.entity';
import { CreateRCARecommendationDto } from './dto/create-rca-recommendation.dto';
import { UpdateRCARecommendationDto } from './dto/update-rca-recommendation.dto';

@ApiTags('RCA Recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('rca-recommendations')
export class RCARecommendationController {
  constructor(private readonly recommendationService: RCARecommendationService) {}

  @Get()
  findAll(): Promise<RCARecommendation[]> {
    return this.recommendationService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<RCARecommendation | null> {
    return this.recommendationService.findOne(id);
  }

  @Post()
  @ApiBody({ type: CreateRCARecommendationDto })
  create(@Body() data: CreateRCARecommendationDto): Promise<RCARecommendation> {
    return this.recommendationService.create(data);
  }

  @Put(':id')
  @ApiBody({ type: UpdateRCARecommendationDto })
  update(@Param('id') id: string, @Body() data: UpdateRCARecommendationDto): Promise<RCARecommendation | null> {
    return this.recommendationService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<void> {
    return this.recommendationService.remove(id);
  }
} 