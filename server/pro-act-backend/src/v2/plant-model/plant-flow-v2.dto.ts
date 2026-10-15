import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import {
  BUFFER_LEVEL_SOURCES,
  BufferLevelSource,
} from '../../plant-model/entities/buffer-level.entity';
import {
  FLOW_ROUTE_ROLES,
  FlowRouteRole,
} from '../../plant-model/entities/plant-flow-route.entity';
import { ListQueryDto } from '../common/list-query.dto';
import { LEDGERS, Ledger } from '../pla-reports/pla-reports.dto';
import {
  DECIMAL,
  EffectiveDto,
  INSTANT,
  INSTANT_MESSAGE,
} from '../profiles/profile-v2.dto';
import { ReportWindowQueryDto } from '../reports/kpi-reports-v2.dto';

const DECIMAL_MESSAGE = 'must be a decimal string ≥ 0 with at most 8 decimals';

/** An optional decimal body field (null clears). */
const OptionalDecimal = (field: string) =>
  applyDecorators(
    IsOptional(),
    ValidateIf((_, value) => value !== null),
    Matches(DECIMAL, { message: `${field} ${DECIMAL_MESSAGE}` }),
  );

/** Body of POST /flow-routes: a draft route of the material-flow map (SME E2). */
export class FlowRouteCreateDto extends EffectiveDto {
  @ApiProperty({ format: 'uuid', description: 'Supplying (upstream) unit' })
  @IsUUID()
  fromUnitId: string;

  @ApiProperty({ format: 'uuid', description: 'Supplied (downstream) unit' })
  @IsUUID()
  toUnitId: string;

  @ApiPropertyOptional({
    enum: FLOW_ROUTE_ROLES,
    default: 'feed',
    description:
      'feed = required supply; alternate = can keep the downstream unit fed on its own',
  })
  @IsOptional()
  @IsIn(FLOW_ROUTE_ROLES)
  routeRole?: FlowRouteRole;

  @ApiPropertyOptional({
    example: '0.98',
    nullable: true,
    description: 'Downstream output per unit of feed (> 0), default 1',
  })
  @OptionalDecimal('yieldFactor')
  yieldFactor?: string | null;

  @ApiPropertyOptional({ example: 'Silo S-1', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(255)
  bufferName?: string | null;

  @ApiPropertyOptional({
    example: '100',
    nullable: true,
    description:
      'Usable buffer inventory when no recent level is recorded; absent = max − min operating level, or no buffer',
  })
  @OptionalDecimal('usableInventory')
  usableInventory?: string | null;

  @ApiPropertyOptional({
    example: '20',
    nullable: true,
    description: 'Lowest operating level (a recorded level is usable above it)',
  })
  @OptionalDecimal('minOperatingLevel')
  minOperatingLevel?: string | null;

  @ApiPropertyOptional({ example: '140', nullable: true })
  @OptionalDecimal('maxOperatingLevel')
  maxOperatingLevel?: string | null;

  @ApiPropertyOptional({
    example: 't',
    nullable: true,
    description: 'Inventory unit (required with a buffer)',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(50)
  inventoryUom?: string | null;

  @ApiPropertyOptional({
    example: '20',
    nullable: true,
    description:
      'Downstream draw from the buffer at full rate, inventory unit per hour (required with a buffer, > 0)',
  })
  @OptionalDecimal('drawRatePerHour')
  drawRatePerHour?: string | null;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class FlowRouteListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Routes from or to this unit',
  })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ enum: VERSION_STATES })
  @IsOptional()
  @IsIn(VERSION_STATES)
  state?: VersionState;
}

/** Body of POST /buffer-levels: a recorded level of a route's buffer (SME E2). */
export class BufferLevelCreateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  fromUnitId: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  toUnitId: string;

  @ApiProperty({ example: '2027-05-01T03:30:00Z' })
  @Matches(INSTANT, { message: `observedAt ${INSTANT_MESSAGE}` })
  observedAt: string;

  @ApiProperty({ example: '60' })
  @Matches(DECIMAL, { message: `level ${DECIMAL_MESSAGE}` })
  level: string;

  @ApiProperty({
    example: 't',
    description: "The route's inventory unit (422 UOM_MISMATCH)",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  uom: string;

  @ApiPropertyOptional({ enum: BUFFER_LEVEL_SOURCES, default: 'manual' })
  @IsOptional()
  @IsIn(BUFFER_LEVEL_SOURCES)
  source?: BufferLevelSource;

  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(4000)
  notes?: string | null;
}

export class BufferLevelListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Levels of buffers feeding this unit',
  })
  @IsOptional()
  @IsUUID()
  toUnitId?: string;
}

/** Query of GET /reports/site-loss (SME E2 / Q13). */
export class SiteLossQueryDto extends ReportWindowQueryDto {
  @ApiPropertyOptional({ enum: LEDGERS, default: 'plan' })
  @IsOptional()
  @IsIn(LEDGERS)
  ledger?: Ledger;
}
