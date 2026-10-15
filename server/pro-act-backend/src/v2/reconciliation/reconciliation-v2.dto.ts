import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  LOSS_BASES,
  LossBasis,
} from '../../domain/accounting/accounting.types';
import {
  DRAFT_ACTIONS,
  DraftAction,
  MANUAL_KINDS,
  ManualKind,
} from '../../domain/reconciliation/reconciliation.types';
import { ListQueryDto } from '../common/list-query.dto';
import {
  BRIDGE_CATEGORIES,
  EVIDENCE_TYPES,
  EvidenceType,
  UNACCOUNTED_CATEGORIES,
} from '../../reconciliation/line-evidence-rules';

/** Signed decimal with at most 16 integer and 8 fractional digits (numeric(24,8), §15.3). */
const DECIMAL = /^-?\d{1,16}(\.\d{1,8})?$/;
const SHA256 = /^[0-9a-f]{64}$/;

export class ReconciliationQueryDto {
  @ApiPropertyOptional({
    enum: ['current', 'approved'],
    description:
      'current (default): the open revision, else the published one; approved: the published revision',
  })
  @IsOptional()
  @IsIn(['current', 'approved'])
  view?: 'current' | 'approved';

  @ApiPropertyOptional({
    minimum: 1,
    description: 'A revision number (wins over view)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revision?: number;
}

export class DraftLineDto {
  @ApiProperty({ enum: DRAFT_ACTIONS })
  @IsIn(DRAFT_ACTIONS)
  action: DraftAction;

  @ApiPropertyOptional({
    description: 'Candidate auto key (accept / adjust / replace / reject)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  autoKey?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Slice of the period (required for manual lines)',
  })
  @IsOptional()
  @IsUUID()
  sliceId?: string;

  @ApiPropertyOptional({
    enum: MANUAL_KINDS,
    description: 'manual and replace lines',
  })
  @IsOptional()
  @IsIn(MANUAL_KINDS)
  kind?: ManualKind;

  @ApiPropertyOptional({
    description:
      'Decimal string, ≤ 8 decimals; negative only for bridge / gain',
  })
  @IsOptional()
  @Matches(DECIMAL, {
    message: 'quantity must be a decimal string with at most 8 decimals',
  })
  quantity?: string;

  @ApiPropertyOptional({ enum: LOSS_BASES })
  @IsOptional()
  @IsIn(LOSS_BASES)
  basis?: LossBasis;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  reasonCodeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  impactCodeId?: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Evidence events (must overlap the slice)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  eventIds?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'An approved actuals adjustment of the period',
  })
  @IsOptional()
  @IsUUID()
  adjustmentId?: string;

  @ApiPropertyOptional({ description: 'The cause is known to be uncoded' })
  @IsOptional()
  @IsBoolean()
  missingCode?: boolean;

  @ApiPropertyOptional({
    description:
      'A cause without an event (needs a reason code or missingCode)',
  })
  @IsOptional()
  @IsBoolean()
  missingEvent?: boolean;

  @ApiPropertyOptional({
    description: 'Required for adjust / replace / reject',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;

  @ApiPropertyOptional({
    enum: [...UNACCOUNTED_CATEGORIES, ...BRIDGE_CATEGORIES],
    description:
      'SME R7 / R8: required for unaccounted_classified (measurement_adjustment, timing_inventory, source_data_gap, unexplained_cause) and bridge (inventory, timing, measurement) lines',
  })
  @IsOptional()
  @IsIn([...UNACCOUNTED_CATEGORIES, ...BRIDGE_CATEGORIES])
  classification?: string;

  @ApiPropertyOptional({
    enum: EVIDENCE_TYPES,
    description:
      'SME R11: the record a manual quantity rests on when no event or approved adjustment backs it',
  })
  @IsOptional()
  @IsIn(EVIDENCE_TYPES)
  evidenceType?: EvidenceType;

  @ApiPropertyOptional({
    maxLength: 200,
    description: 'Reference of that record (work order, sample, tag, …)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  evidenceRef?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'SME R9: the approved line (published revision of an earlier period of the unit) a `reversal` line reverses; ' +
      'the reversal has the opposite sign and at most the quantity not yet reversed (422 REVERSAL_*)',
  })
  @IsOptional()
  @IsUUID()
  reversesLineId?: string;
}

export class DraftLinesDto {
  @ApiProperty({ minimum: 1, description: 'The draft revision number' })
  @IsInt()
  @Min(1)
  revision: number;

  @ApiProperty({
    format: 'uuid',
    description: 'The run the editor read (baseRunId of the view)',
  })
  @IsUUID()
  baseRunId: string;

  @ApiProperty({
    type: [DraftLineDto],
    description: 'The full set of decisions and manual lines',
  })
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => DraftLineDto)
  lines: DraftLineDto[];
}

export class SubmitRevisionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision: number;

  @ApiProperty({
    format: 'uuid',
    description: 'baseRunId of the view the submitter read',
  })
  @IsUUID()
  runId: string;

  @ApiProperty({ description: 'contentHash of the view the submitter read' })
  @Matches(SHA256, { message: 'contentHash must be a sha256 hex digest' })
  contentHash: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ApproveRevisionDto {
  @ApiProperty({ minimum: 1, description: 'The submitted revision number' })
  @IsInt()
  @Min(1)
  revision: number;

  @ApiProperty({
    description: 'submittedHash of the revision the approver read',
  })
  @Matches(SHA256, { message: 'submittedHash must be a sha256 hex digest' })
  submittedHash: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  comment?: string;
}

export class ReasonedRevisionDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  revision: number;

  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  reason: string;
}

/** Reject: the reason, and optionally the lines or candidates that failed (SME R6). */
export class RejectRevisionDto extends ReasonedRevisionDto {
  @ApiPropertyOptional({
    type: [String],
    maxItems: 50,
    description:
      'Line ids or candidate auto keys of the reviewed revision that failed (422 INVALID_REFERENCE otherwise)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(128, { each: true })
  failedLines?: string[];
}

export class ReviseRevisionDto {
  @ApiProperty({
    minimum: 1,
    description: 'The published approved revision number',
  })
  @IsInt()
  @Min(1)
  approvedRevision: number;

  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  reason: string;
}

export class ProposalDecisionDto {
  @ApiProperty()
  @IsString()
  @Length(1, 2000)
  reason: string;
}

/** SME R4: a user proposes a correction of an approved period of a closing or locked month. */
export class ManualProposalDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  periodId: string;

  @ApiProperty({
    minimum: 1,
    description: 'The published approved revision number to correct',
  })
  @IsInt()
  @Min(1)
  approvedRevision: number;

  @ApiProperty({ description: 'What is wrong and what should change' })
  @IsString()
  @Matches(/\S/, { message: 'reason must not be blank' })
  @Length(1, 2000)
  reason: string;

  @ApiProperty({
    enum: EVIDENCE_TYPES,
    description: 'The record the correction rests on',
  })
  @IsIn(EVIDENCE_TYPES)
  evidenceType: EvidenceType;

  @ApiProperty({
    maxLength: 200,
    description: 'Reference of that record (work order, sample, log entry, …)',
  })
  @IsString()
  @Matches(/\S/, { message: 'evidenceRef must not be blank' })
  @Length(1, 200)
  evidenceRef: string;
}

export class RecomputeRequestDto {
  @ApiPropertyOptional({
    description:
      'Why the period is recomputed (recorded on the revision history)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class WorkflowListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['-createdAt'] })
  @IsOptional()
  @IsIn(['-createdAt'])
  sort?: string = undefined;
}
