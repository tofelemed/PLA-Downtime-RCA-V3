import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RecommendationDto {
  @ApiProperty({ description: 'Recommendation ID' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Recommendation description' })
  @IsString()
  description: string;

  @ApiProperty({ description: 'Effectiveness rating' })
  @IsString()
  effectiveness: string;

  @ApiProperty({ description: 'Implementation cost', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  implementationCost?: number;

  @ApiProperty({ description: 'Implementation time (days)', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  implementationTime?: number;
}

export class CreateRCAKnowledgeBaseDto {
  @ApiProperty({ description: 'Tenant ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ description: 'Organization ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  @ApiProperty({ description: 'Source RCA ID' })
  @IsString()
  @MaxLength(36)
  rcaId: string;

  @ApiProperty({ description: 'Article title' })
  @IsString()
  @MaxLength(255)
  title: string;

  @ApiProperty({ description: 'Detailed description', required: false })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ description: 'Problem statement', required: false })
  @IsOptional()
  @IsString()
  problemStatement?: string;

  @ApiProperty({ description: 'Event type', required: false })
  @IsOptional()
  @IsString()
  eventType?: string;

  @ApiProperty({ description: 'Unit ID', required: false })
  @IsOptional()
  @IsString()
  unitId?: string;

  @ApiProperty({ description: 'Unit name', required: false })
  @IsOptional()
  @IsString()
  unitName?: string;

  @ApiProperty({ description: 'Asset ID', required: false })
  @IsOptional()
  @IsString()
  assetId?: string;

  @ApiProperty({ description: 'Asset name', required: false })
  @IsOptional()
  @IsString()
  assetName?: string;

  @ApiProperty({ description: 'Equipment category', required: false })
  @IsOptional()
  @IsString()
  equipmentCategory?: string;

  @ApiProperty({ description: 'Category', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string;

  @ApiProperty({ description: 'Symptoms', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  symptoms?: string[];

  @ApiProperty({ description: 'Impact codes', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  impactCodes?: string[];

  @ApiProperty({ description: 'OEE codes', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  oeeCodes?: string[];

  @ApiProperty({ description: 'Root cause', required: false })
  @IsOptional()
  @IsString()
  rootCause?: string;

  @ApiProperty({ description: 'Root cause category', required: false })
  @IsOptional()
  @IsString()
  rootCauseCategory?: string;

  @ApiProperty({ description: 'Contributing factors', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  contributingFactors?: string[];

  @ApiProperty({ description: 'Recommendations', required: false, type: [RecommendationDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecommendationDto)
  recommendations?: RecommendationDto[];

  @ApiProperty({ description: 'Recurrence count', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  recurrenceCount?: number;

  @ApiProperty({ description: 'Effectiveness score', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  effectiveness?: number;

  @ApiProperty({ description: 'Cost saved', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  costSaved?: number;

  @ApiProperty({ description: 'Downtime reduced (minutes)', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  downtimeReduced?: number;

  @ApiProperty({ description: 'Keywords', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @ApiProperty({ description: 'Tags', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiProperty({ description: 'Article content', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: 'Related RCA IDs', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  relatedRcas?: string[];

  @ApiProperty({ description: 'Author user ID', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  author?: string;

  @ApiProperty({ description: 'Is published', required: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @ApiProperty({ description: 'Times referenced', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  timesReferenced?: number;

  @ApiProperty({ description: 'Helpful votes', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  helpfulVotes?: number;

  @ApiProperty({ description: 'Closed date ISO string', required: false })
  @IsOptional()
  @IsString()
  closedDate?: string;
}

