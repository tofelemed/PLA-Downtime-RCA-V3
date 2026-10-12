import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { toArrayParam } from '../../../common/dto/query-param.transformers';
import { ListQueryDto } from '../../common/list-query.dto';

export const AUDIT_SORTS = ['-timestamp', 'timestamp'] as const;

/** Filters of the audit trail (list, summary and CSV export); `from` / `to` bound the entry time. */
export class AuditFiltersDto extends ListQueryDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Actions (CREATE, UPDATE, LOGIN, …)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  actions?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Entity types (User, Task, RCA, …)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  entityTypes?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Actors' })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('all', { each: true })
  userIds?: string[];

  @ApiPropertyOptional({ maxLength: 36, description: 'Entries of one record' })
  @IsOptional()
  @IsString()
  @MaxLength(36)
  entityId?: string;

  @ApiPropertyOptional({
    maxLength: 100,
    description: 'Case-insensitive search in action, entity type and details',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}

/** `GET /v2/audit-logs`. */
export class AuditListQueryDto extends AuditFiltersDto {
  @ApiPropertyOptional({ enum: AUDIT_SORTS, default: '-timestamp' })
  @IsOptional()
  @IsIn(AUDIT_SORTS)
  sort?: string = undefined;
}
