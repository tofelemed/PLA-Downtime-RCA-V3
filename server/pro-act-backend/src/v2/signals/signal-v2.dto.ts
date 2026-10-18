import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  INTERPOLATIONS,
  RATE_TIMEBASES,
  RESET_POLICIES,
  SIGNAL_SEMANTIC_TYPES,
} from '../../signals/entities/signal.entity';
import { ListQueryDto } from '../common/list-query.dto';

const DECIMAL = /^-?\d{1,16}(\.\d{1,8})?$/;
const DECIMAL_MESSAGE =
  'must be a decimal string with up to 16 integer and 8 fraction digits';

export class SignalQualityPolicyDto {
  @ApiPropertyOptional({
    description:
      'Use uncertain (questionable/substituted) samples; default false = good only',
  })
  @IsOptional()
  @IsBoolean()
  acceptUncertain?: boolean;
}

/** Body of POST /signals. A signal for a source key that already has a current version becomes its next version. */
export class SignalV2WriteDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Integration connection of the caller tenant',
  })
  @IsUUID()
  connectionId: string;

  @ApiProperty({ description: 'Display name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name: string;

  @ApiProperty({
    description:
      'Source stream id: PI WebId, MQTT measurement payload signal field, or full MQTT state_json topic',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  sourceKey: string;

  @ApiPropertyOptional({
    description: 'PI path of the stream (documentation only)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourcePath?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiProperty({ enum: SIGNAL_SEMANTIC_TYPES })
  @IsIn(SIGNAL_SEMANTIC_TYPES)
  semanticType: (typeof SIGNAL_SEMANTIC_TYPES)[number];

  @ApiPropertyOptional({
    description:
      'Canonical unit (e.g. t, t/h); samples in another unit are quarantined',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  canonicalUom?: string;

  @ApiPropertyOptional({
    enum: RATE_TIMEBASES,
    description: 'Required for rate signals',
  })
  @IsOptional()
  @IsIn(RATE_TIMEBASES)
  rateTimebase?: (typeof RATE_TIMEBASES)[number];

  @ApiPropertyOptional({ enum: INTERPOLATIONS, default: 'step' })
  @IsOptional()
  @IsIn(INTERPOLATIONS)
  interpolation?: (typeof INTERPOLATIONS)[number];

  @ApiPropertyOptional({ default: 900, minimum: 1, maximum: 604800 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(604800)
  maxGapSeconds?: number;

  @ApiPropertyOptional({ enum: RESET_POLICIES, default: 'none' })
  @IsOptional()
  @IsIn(RESET_POLICIES)
  resetPolicy?: (typeof RESET_POLICIES)[number];

  @ApiPropertyOptional({
    description: 'Counters: rollover modulus (decimal string)',
  })
  @IsOptional()
  @Matches(DECIMAL, { message: `rolloverModulus ${DECIMAL_MESSAGE}` })
  rolloverModulus?: string;

  @ApiPropertyOptional({
    description: 'Lowest credible value (decimal string)',
  })
  @IsOptional()
  @Matches(DECIMAL, { message: `expectedMin ${DECIMAL_MESSAGE}` })
  expectedMin?: string;

  @ApiPropertyOptional({
    description:
      'Rates: highest credible value; counters: highest credible increase per rateTimebase',
  })
  @IsOptional()
  @Matches(DECIMAL, { message: `expectedMax ${DECIMAL_MESSAGE}` })
  expectedMax?: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 86400 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(86400)
  cadenceSeconds?: number;

  @ApiPropertyOptional({ type: SignalQualityPolicyDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => SignalQualityPolicyDto)
  qualityPolicy?: SignalQualityPolicyDto;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isAuthority?: boolean;

  @ApiPropertyOptional({
    description:
      'Start of validity (ISO 8601). Default: now for a next version, the epoch for a first one',
  })
  @IsOptional()
  @IsISO8601()
  effectiveFrom?: string;
}

export class SignalListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @ApiPropertyOptional({ enum: SIGNAL_SEMANTIC_TYPES })
  @IsOptional()
  @IsIn(SIGNAL_SEMANTIC_TYPES)
  semanticType?: (typeof SIGNAL_SEMANTIC_TYPES)[number];
}

/** Body of POST /signals/{id}/preview and POST /signals/{id}/backfill: half-open `[from, to)`. */
export class SignalWindowDto {
  @ApiProperty({ description: 'Window start, ISO 8601 (inclusive)' })
  @IsISO8601()
  from: string;

  @ApiProperty({ description: 'Window end, ISO 8601 (exclusive)' })
  @IsISO8601()
  to: string;
}
