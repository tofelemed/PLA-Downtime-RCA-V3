import { ApiProperty } from '@nestjs/swagger';

export class CreateTenantDto {
  @ApiProperty()
  code: string;

  @ApiProperty()
  name: string;

  @ApiProperty({ required: false })
  description?: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty({ default: true })
  isActive?: boolean;

  @ApiProperty({ required: false })
  address?: string;

  @ApiProperty({ required: false })
  contactPerson?: string;

  @ApiProperty({ required: false })
  contactEmail?: string;

  @ApiProperty({ required: false })
  contactPhone?: string;
} 