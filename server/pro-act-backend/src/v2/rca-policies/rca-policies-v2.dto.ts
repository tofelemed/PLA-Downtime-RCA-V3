import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export const RCA_AUTO_CREATE = ['recommend', 'create'] as const;
export const RCA_POLICY_LIMIT_DEFAULT = 20;
export const RCA_POLICY_LIMIT_MAX = 100;

const UNIT_DESCRIPTION =
  'A unit of the tenant and the caller’s scope (422 INVALID_REFERENCE); omitted = the tenant-wide policy';

/** `GET /api/v2/rca-policies/current` */
export class RcaPolicyCurrentQueryDto {
  @ApiPropertyOptional({ format: 'uuid', description: UNIT_DESCRIPTION })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

/** `GET /api/v2/rca-policies`: versions of one scope, newest version first. */
export class RcaPolicyListQueryDto extends RcaPolicyCurrentQueryDto {
  @ApiPropertyOptional({
    description: 'Opaque cursor returned as nextCursor by the previous page',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: RCA_POLICY_LIMIT_MAX,
    default: RCA_POLICY_LIMIT_DEFAULT,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(RCA_POLICY_LIMIT_MAX)
  limit: number = RCA_POLICY_LIMIT_DEFAULT;
}

/** `POST /api/v2/rca-policies`: a new approved version of the tenant-wide or one unit's RCA trigger policy. */
export class RcaPolicyCreateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: `${UNIT_DESCRIPTION} (needs a tenant-wide grant, 403 TENANT_SCOPE_REQUIRED)`,
  })
  @IsOptional()
  @IsUUID()
  unitId?: string | null;

  @ApiProperty({
    minimum: 0,
    description:
      'Unplanned downtime at or above this many seconds fires the duration trigger; 0 disables it',
  })
  @IsInt()
  @Min(0)
  durationThresholdSeconds!: number;

  @ApiProperty({
    minimum: 1,
    description:
      'Functional failures of one asset within repeatWindowDays that fire the repeat trigger',
  })
  @IsInt()
  @Min(1)
  repeatCount!: number;

  @ApiProperty({ minimum: 1, maximum: 365 })
  @IsInt()
  @Min(1)
  @Max(365)
  repeatWindowDays!: number;

  @ApiProperty({
    enum: RCA_AUTO_CREATE,
    description: 'recommend = suggest a case; create = open the case',
  })
  @IsIn(RCA_AUTO_CREATE)
  autoCreate!: (typeof RCA_AUTO_CREATE)[number];

  @ApiPropertyOptional({
    nullable: true,
    minimum: 0,
    description:
      'Approved valued impact at or above this fires the cost trigger; null disables it',
  })
  @IsOptional()
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  costThreshold?: number | null;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}
