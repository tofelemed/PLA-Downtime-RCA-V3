import { ApiProperty } from '@nestjs/swagger';
import {
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Client-side audit entry (sent with `X-Client-Audited`). `userId`, `tenantId` and `organizationId` are
 * accepted for compatibility but replaced by the caller identity on the server (WF05).
 */
export class CreateAuditLogDto {
  @ApiProperty({
    required: false,
    description: 'Ignored: taken from the caller identity',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  userName?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  action: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  entityType: string;

  @ApiProperty()
  @IsString()
  @MaxLength(36)
  entityId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  details?: string;

  @ApiProperty({
    required: false,
    description: 'Ignored: taken from the caller identity',
  })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  organizationId?: string;

  @ApiProperty({
    required: false,
    description: 'Ignored: taken from the caller identity',
  })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  tenantId?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  ipAddress?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  @IsOptional()
  @IsISO8601()
  timestamp?: string;
}
