import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { toBooleanParam } from '../../common/dto/query-param.transformers';
import { ListQueryDto } from '../common/list-query.dto';

export const KNOWLEDGE_SORTS = ['-createdAt', 'createdAt'] as const;

/** `GET /v2/rca-knowledge`: server-side search over the knowledge entries of the caller's scope. */
export class RcaKnowledgeListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    maxLength: 100,
    description:
      'Case-insensitive text search in title, root cause, problem statement and description',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  assetId?: string;

  @ApiPropertyOptional({
    description:
      'Entries whose source case has a linked event coded with this reason (failure) code',
  })
  @IsOptional()
  @IsUUID()
  reasonCodeId?: string;

  @ApiPropertyOptional({
    description: 'true = published only, false = unpublished only',
  })
  @IsOptional()
  @Transform(toBooleanParam)
  @IsBoolean()
  published?: boolean;

  @ApiPropertyOptional({ enum: KNOWLEDGE_SORTS })
  @IsOptional()
  @IsIn(KNOWLEDGE_SORTS)
  sort?: string = undefined;
}

/** `GET /v2/rca-knowledge/similar`: entries that match an event's asset, reason or unit. */
export class RcaKnowledgeSimilarQueryDto {
  @ApiProperty()
  @IsUUID()
  eventId: string;

  @ApiPropertyOptional({ minimum: 1, maximum: 20, default: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 5;
}

/**
 * `POST /v2/rca-knowledge/{id}/votes`: the caller's vote (replaces an earlier vote of the same user). The
 * raw value is validated (implicit conversion would turn "no" into true).
 */
export class RcaKnowledgeVoteDto {
  @ApiProperty({ description: 'true = helpful, false = not helpful' })
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj.helpful)
  @IsBoolean()
  helpful: boolean;
}
