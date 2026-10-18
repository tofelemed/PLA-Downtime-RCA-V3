import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { RECONCILIATION_STATES } from '../../stop-events/entities/stop-reconciliation.entity';
import { ListQueryDto } from '../common/list-query.dto';
import { CommissioningBackdateDto } from '../common/commissioning-backdate.dto';

export class StopReconciliationListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only pairs of this unit',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only pairs with this event on either side',
  })
  @IsOptional()
  @IsUUID()
  eventId?: string;

  @ApiPropertyOptional({
    enum: RECONCILIATION_STATES,
    description: 'Default: every state',
  })
  @IsOptional()
  @IsIn(RECONCILIATION_STATES)
  state?: (typeof RECONCILIATION_STATES)[number];
}

/** Why a person accepted, rejected or undid a duplicate merge (kept with the decision and the revisions). */
export class StopDecisionDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class StopIncidentListQueryDto extends ListQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;
}

export class NewFailureMarkDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'Stop occurrence that is a new failure (function restored before it)',
  })
  @IsUUID()
  occurrenceId: string;

  @ApiProperty({
    minLength: 1,
    maxLength: 1000,
    description: 'e.g. the verified repair before this stop',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}

export class StopEventPolicyQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Unit override; absent = the tenant-wide version',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

const seconds = (description: string) => ({
  minimum: 0,
  maximum: 86400,
  description,
});

/** Plan 1.10 / DT-04 / SME D5 settings of a new `oee_policy` version; absent fields keep the version in force. */
export class StopEventPolicyCreateDto extends CommissioningBackdateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Unit override; absent = the tenant-wide version',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({
    description: 'Derive stop events from the unit state signal',
  })
  @IsOptional()
  @IsBoolean()
  deriveFromState?: boolean;

  @ApiPropertyOptional(
    seconds('DT02: shorter stop occurrences are chatter (pilot 5)'),
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  debounceSeconds?: number;

  @ApiPropertyOptional(
    seconds('DT02: shorter running between stops is not a restart (pilot 10)'),
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  restartConfirmSeconds?: number;

  @ApiPropertyOptional(
    seconds(
      'DT-04: start / end difference of one stop recorded twice (pilot 120)',
    ),
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  duplicateToleranceSeconds?: number;

  @ApiPropertyOptional({
    description:
      'Merge unique cross-source duplicates automatically (false = suggest only)',
  })
  @IsOptional()
  @IsBoolean()
  autoMergeDuplicates?: boolean;

  @ApiPropertyOptional(
    seconds(
      'SME D5: repeat stops of one asset and reason within this form one incident (pilot 120)',
    ),
  )
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  incidentWindowSeconds?: number;

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class DerivedStopPreviewQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    description: 'Window start, ISO 8601 (at most 7 days before `to`)',
  })
  @IsISO8601()
  from: string;

  @ApiProperty({
    description: 'Window end (exclusive); a stop reaching it is reported open',
  })
  @IsISO8601()
  to: string;
}
