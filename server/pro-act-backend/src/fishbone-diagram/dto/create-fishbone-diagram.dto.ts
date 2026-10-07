import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateFishboneDiagramDto {
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

  @ApiProperty({ description: 'RCA ID' })
  @IsString()
  @MaxLength(36)
  rcaId: string;

  @ApiProperty({ description: 'Problem statement', required: false })
  @IsOptional()
  @IsString()
  problemStatement?: string;

  @ApiProperty({ description: 'Categories (JSON)', required: false })
  @IsOptional()
  @IsString()
  categories?: string;

  @ApiProperty({ description: 'Causes (JSON)', required: false })
  @IsOptional()
  @IsString()
  causes?: string;
}

