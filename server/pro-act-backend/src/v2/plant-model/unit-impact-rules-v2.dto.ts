import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import {
  UNIT_IMPACT_MODES,
  UnitImpactMode,
} from '../../domain/reliability/unit-impact';
import { ListQueryDto } from '../common/list-query.dto';
import { DECIMAL, EffectiveDto } from '../profiles/profile-v2.dto';

/** Body of POST /unit-impact-rules: a draft rule of one asset of a unit (plan 1.10, SME Q5 + D9). */
export class UnitImpactRuleCreateDto extends EffectiveDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({
    format: 'uuid',
    description:
      'The equipment whose stops the rule classifies (an asset of the unit)',
  })
  @IsUUID()
  assetId: string;

  @ApiProperty({
    enum: UNIT_IMPACT_MODES,
    description:
      'full_stop = the unit stops; fractional = the unit loses `fraction` of its rate (one of several trains); none = output holds',
  })
  @IsIn(UNIT_IMPACT_MODES)
  mode: UnitImpactMode;

  @ApiPropertyOptional({
    example: '0.5',
    nullable: true,
    description:
      'Share of the unit rate lost, 0 < f ≤ 1; only (and required) with fractional',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(DECIMAL, {
    message: 'fraction must be a decimal string with at most 8 decimals',
  })
  fraction?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Installed standby whose successful start holds the output (SME D9 standby log runs)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  standbyAssetId?: string | null;

  @ApiPropertyOptional({
    default: 60,
    minimum: 0,
    maximum: 86400,
    description:
      'A standby run starting at most this many seconds after the stop is a takeover',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(86400)
  takeoverSeconds?: number;

  @ApiProperty({
    example: 'Two parallel extruder feed trains; one train = 50 % of the rate',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class UnitImpactRuleListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({ enum: VERSION_STATES })
  @IsOptional()
  @IsIn(VERSION_STATES)
  state?: VersionState;
}
