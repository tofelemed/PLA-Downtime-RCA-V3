import { ApiProperty } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateBarrierAnalysisDto {
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
  hazard: string;

  @ApiProperty({ type: Array })
  @IsArray()
  barriers: Record<string, any>[];
}


