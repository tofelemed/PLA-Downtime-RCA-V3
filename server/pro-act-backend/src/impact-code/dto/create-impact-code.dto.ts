import { ApiProperty } from '@nestjs/swagger';

export class CreateImpactCodeDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ required: false })
  costPerUnit?: number;

  @ApiProperty({ required: false })
  costPerHour?: number;

  @ApiProperty({ required: false })
  costBasis?: string;

  @ApiProperty()
  tenantId: string;
} 