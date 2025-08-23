import { ApiProperty } from '@nestjs/swagger';

export class CreateAuditLogDto {
  @ApiProperty()
  userId: string;

  @ApiProperty()
  userName: string;

  @ApiProperty()
  action: string;

  @ApiProperty()
  entityType: string;

  @ApiProperty()
  entityId: string;

  @ApiProperty()
  details: string;

  @ApiProperty()
  organizationId: string;

  @ApiProperty()
  tenantId: string;

  @ApiProperty({ required: false })
  ipAddress?: string;

  @ApiProperty({ required: false })
  userAgent?: string;

  @ApiProperty({ required: false, type: String, format: 'date-time' })
  timestamp?: Date;
} 