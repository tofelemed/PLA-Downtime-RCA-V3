import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  role: string;

  // Option 1: Provide existing UUIDs
  @ApiProperty({ 
    required: false,
    description: 'Existing tenant ID (UUID). If not provided, tenantName will be used to create a new tenant.'
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsUUID()
  tenantId?: string;

  @ApiProperty({ 
    required: false,
    description: 'Existing organization ID (UUID). If not provided, organizationName will be used to create a new organization.'
  })
  @IsOptional()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  @IsUUID()
  organizationId?: string;

  // Option 2: Provide names to auto-create
  @ApiProperty({ 
    required: false,
    description: 'Organization name. If provided and organizationId is not set, a new organization will be created.'
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  organizationName?: string;

  @ApiProperty({ 
    required: false,
    description: 'Tenant name. If provided and tenantId is not set, a new tenant will be created. Requires organizationId or organizationName.'
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (value === '' || value == null ? undefined : value))
  tenantName?: string;
} 