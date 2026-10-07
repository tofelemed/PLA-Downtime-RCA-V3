import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateFaultTreeAnalysisDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(36)
  rcaId: string;

  @ApiProperty()
  @IsString()
  topEvent: string;

  @ApiProperty({ type: Array })
  @IsArray()
  nodes: Record<string, any>[];

  @ApiProperty({ required: false, type: Array })
  @IsOptional()
  @IsArray()
  minimumCutSets?: string[][];
}


