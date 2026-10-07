import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, MaxLength } from 'class-validator';

export class CreatePIConnectionDto {
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

  @ApiProperty({ description: 'Connection name' })
  @IsString()
  @MaxLength(255)
  connectionName: string;

  @ApiProperty({ description: 'PI Web API URL' })
  @IsString()
  @MaxLength(500)
  piWebApiUrl: string;

  @ApiProperty({ description: 'Username', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  username?: string;

  @ApiProperty({ description: 'Encrypted password', required: false })
  @IsOptional()
  @IsString()
  passwordEncrypted?: string;

  @ApiProperty({ description: 'AF Database path', required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  afDatabasePath?: string;

  @ApiProperty({ description: 'Additional connection configuration (JSON)', required: false })
  @IsOptional()
  connectionConfig?: Record<string, any>;

  @ApiProperty({ description: 'Is active', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

