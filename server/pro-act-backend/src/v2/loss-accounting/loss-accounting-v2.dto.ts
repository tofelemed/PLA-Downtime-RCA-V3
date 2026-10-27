import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import {
  LossBasis,
  LossGrain,
  LossTargetSource,
} from '../../periods/loss-accounting-policy';
import { CommissioningBackdateDto } from '../common/commissioning-backdate.dto';
import { ListQueryDto } from '../common/list-query.dto';
import {
  SOURCE_AUTHORITY_VERSION_STATES as LOSS_ACCOUNTING_VERSION_STATES,
  SourceAuthorityVersionState as LossAccountingVersionState,
} from '../source-authority/source-authority-v2.view';

const GRAINS = ['shift', 'day'] as const;
const BASES = ['computed', 'declared'] as const;
const TARGET_SOURCES = ['plan', 'declared'] as const;

/**
 * Body of POST /loss-accounting/versions. Every policy field is optional: a missing one is kept from the
 * version in force; the draft is checked by the parser the engine applies (422 INVALID_POLICY).
 */
export class LossAccountingVersionDto extends CommissioningBackdateDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Unit override; absent = the tenant-wide version',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({
    enum: GRAINS,
    description: 'Accounting period: one per shift, or one per operational day',
  })
  @IsOptional()
  @IsIn(GRAINS)
  grain?: LossGrain;

  @ApiPropertyOptional({
    example: '06:00',
    description: 'Plant-local HH:mm the operational day starts; used by day',
  })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'dayStart must be HH:mm' })
  dayStart?: string;

  @ApiPropertyOptional({
    enum: BASES,
    description: 'Loss lines computed from the plan, or declared by OT',
  })
  @IsOptional()
  @IsIn(BASES)
  lossBasis?: LossBasis;

  @ApiPropertyOptional({
    enum: TARGET_SOURCES,
    description: 'Declared mode: the target is the plan or the OT planned',
  })
  @IsOptional()
  @IsIn(TARGET_SOURCES)
  targetSource?: LossTargetSource;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'The unit the accounting is kept on; null = the version unit',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  accountingUnitId?: string | null;

  @ApiPropertyOptional({
    description: 'Cross-check declared losses against the recorded stops',
  })
  @IsOptional()
  @IsBoolean()
  stopsCrossCheck?: boolean;

  @ApiPropertyOptional({
    minimum: 0,
    description: 'Identity tolerance in the event unit of measure',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  identityTolerance?: number;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class LossAccountingQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Unit whose version in force is read; absent = tenant-wide',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class LossAccountingVersionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Versions of this unit only; absent = every scope the caller sees',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({
    description:
      'With unitId: the plant-wide versions as well (unitId null); alone: only the plant-wide versions',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  includeTenantWide?: boolean;

  @ApiPropertyOptional({ enum: LOSS_ACCOUNTING_VERSION_STATES })
  @IsOptional()
  @IsIn(LOSS_ACCOUNTING_VERSION_STATES)
  state?: LossAccountingVersionState;
}
