import { ApiProperty, OmitType } from '@nestjs/swagger';
import { IsISO8601 } from 'class-validator';
import { ProductionEventListQueryDto } from './production-event-list-query.dto';

/**
 * `GET /api/v2/production-events/export`: every filter of the list (same validators), no paging or sort
 * (newest first), and a required window of at most 400 days.
 */
export class ProductionEventExportQueryDto extends OmitType(
  ProductionEventListQueryDto,
  ['cursor', 'limit', 'sort', 'from', 'to'] as const,
) {
  @ApiProperty({
    description:
      'Window start, ISO 8601 (inclusive); intervals use overlap semantics',
  })
  @IsISO8601()
  from!: string;

  @ApiProperty({
    description:
      'Window end, ISO 8601 (exclusive); at most 400 days after from',
  })
  @IsISO8601()
  to!: string;
}
