import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
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
  UNCERTAINTY_COMPONENT_KINDS,
  UncertaintyComponentKind,
} from '../../domain/uncertainty/uncertainty-budget';
import {
  UNCERTAINTY_BUDGET_STATES,
  UncertaintyBudgetState,
} from '../../uncertainty/entities/uncertainty-budget.entity';
import { ListQueryDto } from '../common/list-query.dto';
import { DECIMAL } from '../profiles/profile-v2.dto';

const SIGNED_DECIMAL = /^-?\d{1,16}(\.\d{1,8})?$/;
const COVERAGE_FACTOR = /^\d{1,2}(\.\d{1,3})?$/;
const BOUNDARY = /^[A-Za-z0-9_.-]{1,64}$/;

export class UncertaintyComponentDto {
  @ApiProperty({ enum: UNCERTAINTY_COMPONENT_KINDS })
  @IsIn(UNCERTAINTY_COMPONENT_KINDS)
  kind: UncertaintyComponentKind;

  @ApiProperty({
    example: 'FT-101 totalizer (calibration 2027-01)',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @ApiProperty({
    example: '3',
    description:
      'Standard uncertainty u (one standard deviation) in the budget unit, decimal string ≥ 0',
  })
  @Matches(DECIMAL, {
    message:
      'standardUncertainty must be a decimal string with at most 8 decimals',
  })
  standardUncertainty: string;

  @ApiPropertyOptional({
    example: '-1',
    description:
      'Sensitivity coefficient c of the reconciled quantity (1 added, −1 subtracted); default 1',
  })
  @IsOptional()
  @Matches(SIGNED_DECIMAL, {
    message:
      'sensitivity must be a signed decimal string with at most 8 decimals',
  })
  sensitivity?: string;
}

export class UncertaintyCorrelationDto {
  @ApiProperty({ minimum: 0, description: 'Index of the first component' })
  @IsInt()
  @Min(0)
  a: number;

  @ApiProperty({ minimum: 0, description: 'Index of the second component' })
  @IsInt()
  @Min(0)
  b: number;

  @ApiProperty({
    example: '0.5',
    description: 'Correlation coefficient r in [-1, 1]',
  })
  @Matches(SIGNED_DECIMAL, {
    message: 'coefficient must be a signed decimal string',
  })
  coefficient: string;
}

/** The maths of a budget: what POST /uncertainty-budgets/preview computes. */
export class UncertaintyBudgetMathsDto {
  @ApiProperty({ type: [UncertaintyComponentDto], minItems: 1, maxItems: 50 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => UncertaintyComponentDto)
  components: UncertaintyComponentDto[];

  @ApiPropertyOptional({ type: [UncertaintyCorrelationDto], maxItems: 200 })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => UncertaintyCorrelationDto)
  correlations?: UncertaintyCorrelationDto[];

  @ApiPropertyOptional({
    example: '2',
    description:
      'Coverage factor k (default 2, about 95 % for a normal distribution), at most 3 decimals',
  })
  @IsOptional()
  @Matches(COVERAGE_FACTOR, {
    message: 'coverageFactor must be a decimal with at most 3 decimals',
  })
  coverageFactor?: string;
}

/** Body of POST /uncertainty-budgets: a budget to approve (SME E4). */
export class UncertaintyBudgetCreateDto extends UncertaintyBudgetMathsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    example: 'reactor_outlet',
    description:
      'Measurement boundary the budget covers (same name as the source_authority hierarchy)',
  })
  @Matches(BOUNDARY, { message: 'boundary is 1-64 letters, digits, _ . -' })
  boundary: string;

  @ApiProperty({ example: 't', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  uom: string;

  @ApiProperty({
    example: 'CAL-FT101-2027-01; scale cert WS-22',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  calibrationRef: string;

  @ApiProperty({
    format: 'date-time',
    description: 'Next review of the budget',
  })
  @IsISO8601({ strict: true })
  reviewDueAt: string;

  @ApiProperty({
    format: 'date-time',
    description: 'When the budget takes effect',
  })
  @IsISO8601({ strict: true })
  effectiveFrom: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  evidenceRef?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;
}

/** Body of POST /uncertainty-budgets/{id}/adopt-as-tolerance. */
export class ToleranceAdoptionDto {
  @ApiPropertyOptional({
    maxLength: 2000,
    description: 'Note on the new tolerance version',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

/** GET /uncertainty-budgets: newest effective date first; from / to overlap the effective interval. */
export class UncertaintyBudgetListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ example: 'reactor_outlet' })
  @IsOptional()
  @Matches(BOUNDARY)
  boundary?: string;

  @ApiPropertyOptional({ enum: UNCERTAINTY_BUDGET_STATES })
  @IsOptional()
  @IsIn(UNCERTAINTY_BUDGET_STATES)
  state?: UncertaintyBudgetState;
}
