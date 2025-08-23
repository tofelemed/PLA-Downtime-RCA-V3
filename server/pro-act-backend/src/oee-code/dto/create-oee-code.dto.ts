import { ApiProperty } from '@nestjs/swagger';

export class CreateOeeCodeDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  category: string;

  @ApiProperty()
  impactType: string;

  @ApiProperty()
  tenantId: string;
} 