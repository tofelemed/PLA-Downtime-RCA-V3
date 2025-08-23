import { ApiProperty } from '@nestjs/swagger';

export class CreateVerificationStatusCodeDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  color: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty({ required: false, type: [String] })
  items?: string[];
} 