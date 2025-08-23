import { ApiProperty } from '@nestjs/swagger';

export class CreateRcaCauseCodeDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  category: string;

  @ApiProperty({ required: false })
  parentId?: string;

  @ApiProperty()
  tenantId: string;
} 