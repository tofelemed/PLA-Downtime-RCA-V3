import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  APPROVAL_STATES,
  ApprovalState,
  Distribution,
  DISTRIBUTIONS,
  PLAN_BASES,
  PlanBasis,
  SLICE_STREAMS,
  SliceStream,
} from '../../domain/plans/plan.types';
import { ListQueryDto } from '../common/list-query.dto';
import { DECIMAL, INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';

/** numeric(12,8) weights: up to 4 integer and 8 fraction digits. */
const WEIGHT = /^\d{1,4}(\.\d{1,8})?$/;

export class PlanSliceDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Profile of the plan unit and this product whose operating mode the slice runs in (default normal)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  profileId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Campaign start (inclusive); absent = plan start',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(INSTANT, { message: `campaignFrom ${INSTANT_MESSAGE}` })
  campaignFrom?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Campaign end (exclusive); absent = plan end',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(INSTANT, { message: `campaignTo ${INSTANT_MESSAGE}` })
  campaignTo?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '1',
    description: 'Weight for explicit_weights',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(WEIGHT, { message: 'weight must be a decimal (4.8)' })
  weight?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '500',
    description:
      'Own target of the slice (quantity basis without a header target; needed when units differ)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DECIMAL, { message: 'target must be a decimal (16.8)' })
  target?: string | null;

  @ApiPropertyOptional({
    enum: SLICE_STREAMS,
    default: 'sequential',
    description:
      'independent / shared need CONCURRENT_PRODUCTS (D14); all slices of a version share one kind',
  })
  @IsOptional()
  @IsIn(SLICE_STREAMS)
  stream?: SliceStream;
}

export class ManualTargetDto {
  @ApiProperty({ minimum: 0, description: 'Index of the slice in `slices`' })
  @IsInt()
  @Min(0)
  slicePosition: number;

  @ApiProperty({
    description: 'UTC start of the leaf (shift instance) the target is for',
  })
  @Matches(INSTANT, { message: `utcStart ${INSTANT_MESSAGE}` })
  utcStart: string;

  @ApiProperty({ example: '120.5' })
  @Matches(DECIMAL, { message: 'target must be a decimal (16.8)' })
  target: string;
}

/** Content of a plan version (PLAN02). */
export class PlanContentDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    example: '2026-11-01T02:30:00Z',
    description: 'Plan window start (inclusive)',
  })
  @Matches(INSTANT, { message: `validFrom ${INSTANT_MESSAGE}` })
  validFrom: string;

  @ApiProperty({
    example: '2026-12-01T02:30:00Z',
    description: 'Plan window end (exclusive)',
  })
  @Matches(INSTANT, { message: `validTo ${INSTANT_MESSAGE}` })
  validTo: string;

  @ApiProperty({
    enum: PLAN_BASES,
    description:
      'time = schedule × planning rate; quantity = header (or slice) target distributed; manual = per-leaf targets',
  })
  @IsIn(PLAN_BASES)
  basis: PlanBasis;

  @ApiPropertyOptional({ nullable: true, example: '1000' })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DECIMAL, { message: 'headerTarget must be a decimal (16.8)' })
  headerTarget?: string | null;

  @ApiPropertyOptional({ enum: DISTRIBUTIONS, default: 'scheduled_capacity' })
  @IsOptional()
  @IsIn(DISTRIBUTIONS)
  distribution?: Distribution;

  @ApiProperty({ type: [PlanSliceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => PlanSliceDto)
  slices: PlanSliceDto[];

  @ApiPropertyOptional({ type: [ManualTargetDto], nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsArray()
  @ArrayMaxSize(20000)
  @ValidateNested({ each: true })
  @Type(() => ManualTargetDto)
  manualTargets?: ManualTargetDto[] | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  changeReason?: string | null;
}

/** Body of POST /production-plans: the header and draft version 1. */
export class PlanCreateDto extends PlanContentDto {
  @ApiProperty({ example: 'HDPE unit100 November' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Default: the tenant accounting-baseline scenario',
  })
  @IsOptional()
  @IsUUID()
  scenarioId?: string;
}

/** Body of POST /production-plans/{id}/versions and PATCH …/versions/{v}: changes to the content. */
export class PlanVersionChangeDto extends PartialType(PlanContentDto) {}

/** Path of one plan version: `/production-plans/{id}/versions/{version}`. */
export class PlanVersionParamsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id: string;

  @ApiProperty({ minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  version: number;
}

export class GeneratePeriodsDto {
  @ApiProperty({
    minimum: 1,
    description: 'The open (draft or submitted) version to generate',
  })
  @IsInt()
  @Min(1)
  version: number;

  @ApiPropertyOptional({
    enum: DISTRIBUTIONS,
    description: 'Overrides (and on a run stores) the distribution',
  })
  @IsOptional()
  @IsIn(DISTRIBUTIONS)
  distribution?: Distribution;

  @ApiPropertyOptional({
    default: false,
    description: 'true = return the periods without storing them',
  })
  @IsOptional()
  @IsBoolean()
  preview?: boolean;
}

export class PlanApproveDto {
  @ApiProperty({
    minimum: 1,
    description: 'Number of the version being approved (the one reviewed)',
  })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class PlanSubmitDto {
  @ApiProperty({
    minimum: 1,
    description: 'Number of the open (draft) version being submitted',
  })
  @IsInt()
  @Min(1)
  expectedVersion: number;
}

export class PlanReturnDto {
  @ApiProperty({
    minimum: 1,
    description: 'Number of the submitted version being returned',
  })
  @IsInt()
  @Min(1)
  expectedVersion: number;

  @ApiProperty({ description: 'Why the version goes back to its author' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class PlanListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['createdAt'] })
  @IsOptional()
  @IsIn(['createdAt'])
  sort?: string = undefined;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  scenarioId?: string;

  @ApiPropertyOptional({
    enum: APPROVAL_STATES,
    description: 'State of the current version',
  })
  @IsOptional()
  @IsIn(APPROVAL_STATES)
  approvalState?: ApprovalState;
}

export class PlanPeriodListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['utcStart'] })
  @IsOptional()
  @IsIn(['utcStart'])
  sort?: string = undefined;
}

/** GET /production-plans/{id}/versions: the version history, newest first (plan 3.4). */
export class PlanVersionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['-createdAt'] })
  @IsOptional()
  @IsIn(['-createdAt'])
  sort?: string = undefined;
}

export class ScenarioListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['createdAt'] })
  @IsOptional()
  @IsIn(['createdAt'])
  sort?: string = undefined;
}

export class ScenarioCreateDto {
  @ApiProperty({ example: 'Budget 2027' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;

  @ApiPropertyOptional({
    default: false,
    description:
      'Move the accounting-baseline flag to this scenario (exactly one per tenant)',
  })
  @IsOptional()
  @IsBoolean()
  isAccountingBaseline?: boolean;
}
