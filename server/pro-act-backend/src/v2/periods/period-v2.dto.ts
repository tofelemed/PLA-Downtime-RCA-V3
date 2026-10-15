import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import {
  ADJUSTMENT_BASES,
  ADJUSTMENT_KINDS,
} from '../../periods/entities/actuals-adjustment.entity';
import { READINESS_STATES } from '../../periods/entities/production-period.entity';
import { ListQueryDto } from '../common/list-query.dto';
import { DECIMAL, INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';

/** numeric(24,8), signed (corrections may reduce a component). */
const SIGNED_DECIMAL = /^-?\d{1,16}(\.\d{1,8})?$/;
const LOCAL_DATE = /^\d{4}-\d{2}-\d{2}$/;

export class PeriodListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['utcStart'] })
  @IsOptional()
  @IsIn(['utcStart'])
  sort?: string = undefined;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Repeat for several units',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Periods with an active slice of these products',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  productIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    enum: READINESS_STATES,
    description: 'Display readiness (workflow states come with 2.8)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @IsIn(READINESS_STATES, { each: true })
  readiness?: string[];
}

export class MaterializePeriodsDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Omit for every unit (tenant-wide grant required)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiProperty({
    description: 'Shift starts from (inclusive), ISO 8601 with offset',
  })
  @Matches(INSTANT, { message: `from ${INSTANT_MESSAGE}` })
  from: string;

  @ApiProperty({
    description: 'Shift starts until (exclusive); at most 92 days after from',
  })
  @Matches(INSTANT, { message: `to ${INSTANT_MESSAGE}` })
  to: string;
}

export class AdjustmentCreateDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Active slice of a period in the caller’s scope',
  })
  @IsUUID()
  sliceId: string;

  @ApiProperty({ enum: ADJUSTMENT_KINDS })
  @IsIn(ADJUSTMENT_KINDS)
  kind: (typeof ADJUSTMENT_KINDS)[number];

  @ApiProperty({
    example: '-2.5',
    description: 'Signed decimal in the slice quantity unit, not zero',
  })
  @Matches(SIGNED_DECIMAL, {
    message: 'quantity must be a signed decimal (16.8)',
  })
  quantity: string;

  @ApiProperty({ enum: ADJUSTMENT_BASES })
  @IsIn(ADJUSTMENT_BASES)
  basis: (typeof ADJUSTMENT_BASES)[number];

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;

  @ApiProperty({
    description:
      'Reference to the evidence (weighbridge ticket, lab report, ...)',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  evidenceRef: string;

  @ApiPropertyOptional({
    description: 'Measurement window start, inside the slice window',
  })
  @IsOptional()
  @Matches(INSTANT, { message: `windowFrom ${INSTANT_MESSAGE}` })
  windowFrom?: string;

  @ApiPropertyOptional({ description: 'Measurement window end (exclusive)' })
  @IsOptional()
  @Matches(INSTANT, { message: `windowTo ${INSTANT_MESSAGE}` })
  windowTo?: string;
}

export class AdjustmentApproveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class AdjustmentRejectDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class ExternalReportLineDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({ nullable: true, example: '1200' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DECIMAL, { message: 'gross must be a decimal (16.8)' })
  gross?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DECIMAL, { message: 'good must be a decimal (16.8)' })
  good?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DECIMAL, { message: 'reject must be a decimal (16.8)' })
  reject?: string | null;

  @ApiPropertyOptional({ nullable: true, example: 't' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(50)
  uom?: string | null;
}

export class ExternalReportCreateDto {
  @ApiProperty({ example: 'MX-DP-2027-03-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  externalReportId: string;

  @ApiProperty({
    example: '1',
    description: 'A higher (numeric) revision supersedes the current one',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  externalRevision: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Default: the tenant’s default site',
  })
  @IsOptional()
  @IsUUID()
  siteId?: string;

  @ApiProperty({ example: '2027-03-01' })
  @Matches(LOCAL_DATE, { message: 'localProductionDate must be YYYY-MM-DD' })
  localProductionDate: string;

  @ApiPropertyOptional({
    example: 'Asia/Tehran',
    description: 'Default: the site timezone',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  timezone?: string;

  @ApiProperty({ description: 'UTC start of the production day (inclusive)' })
  @Matches(INSTANT, { message: `utcStart ${INSTANT_MESSAGE}` })
  utcStart: string;

  @ApiProperty({ description: 'UTC end of the production day (exclusive)' })
  @Matches(INSTANT, { message: `utcEnd ${INSTANT_MESSAGE}` })
  utcEnd: string;

  @ApiProperty({ enum: ['gross', 'good'] })
  @IsIn(['gross', 'good'])
  basis: 'gross' | 'good';

  @ApiProperty({ example: 'COMPLETED' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  sourceStatus: string;

  @ApiPropertyOptional({
    example: 'mes',
    description:
      'SME R13: the source system whose status mapping decides release (default `import`)',
  })
  @IsOptional()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9_.-]{0,63}$/)
  sourceSystem?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(INSTANT, { message: `approvedAtSource ${INSTANT_MESSAGE}` })
  approvedAtSource?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  evidenceRef?: string;

  @ApiProperty({ type: [ExternalReportLineDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(500)
  @ValidateNested({ each: true })
  @Type(() => ExternalReportLineDto)
  lines: ExternalReportLineDto[];
}

export class ExternalReportCsvDto {
  @ApiProperty({
    description:
      'CSV document (≤ 1 MB): externalReportId, externalRevision, localProductionDate, utcStart, utcEnd, basis, ' +
      'sourceStatus, unitId, productId and optionally siteId, timezone, approvedAtSource, evidenceRef, sourceSystem, gross, good, reject, uom',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1_000_000)
  csv: string;
}
