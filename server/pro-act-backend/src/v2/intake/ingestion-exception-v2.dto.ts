import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import {
  INGESTION_ERROR_CODES,
  INGESTION_EXCEPTION_STATES,
  IngestionErrorCode,
  IngestionExceptionState,
} from '../../intake/entities/ingestion-exception.entity';
import { ListQueryDto } from '../common/list-query.dto';

export const EXCEPTION_SORTS = [
  'lastSeen',
  '-lastSeen',
  'firstSeen',
  '-firstSeen',
] as const;

/** GET /ingestion-exceptions: keyset pages, newest `lastSeen` first by default. */
export class IngestionExceptionListQueryDto extends ListQueryDto {
  // Redeclared with an initializer (TS2612) so the allowlist applies on top of the base validators.
  @ApiPropertyOptional({ enum: EXCEPTION_SORTS, default: '-lastSeen' })
  @IsOptional()
  @IsIn(EXCEPTION_SORTS)
  sort?: string = undefined;

  @ApiPropertyOptional({ enum: INGESTION_EXCEPTION_STATES })
  @IsOptional()
  @IsIn(INGESTION_EXCEPTION_STATES)
  state?: IngestionExceptionState;

  @ApiPropertyOptional({ enum: INGESTION_ERROR_CODES })
  @IsOptional()
  @IsIn(INGESTION_ERROR_CODES)
  errorCode?: IngestionErrorCode;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  connectionId?: string;

  @ApiPropertyOptional({ maxLength: 512 })
  @IsOptional()
  @IsString()
  @MaxLength(512)
  sourceObjectId?: string;
}

export const RESOLVE_ACTIONS = ['replay', 'irrecoverable'] as const;

/** Body of POST /ingestion-exceptions/{id}/resolve. */
export class ResolveIngestionExceptionV2Dto {
  @ApiProperty({
    enum: RESOLVE_ACTIONS,
    description:
      '`replay`: fix the mapping first, then replay the source object (202 + replay run); ' +
      '`irrecoverable`: close the exception without data (kept for audit).',
  })
  @IsIn(RESOLVE_ACTIONS)
  action: (typeof RESOLVE_ACTIONS)[number];

  @ApiProperty({ maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason: string;
}
