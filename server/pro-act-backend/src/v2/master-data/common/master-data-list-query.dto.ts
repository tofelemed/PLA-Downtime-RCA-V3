import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ListQueryDto } from '../../common/list-query.dto';

export const MASTER_DATA_SORTS = ['code', 'name', 'createdAt'] as const;
export type MasterDataSortField = (typeof MASTER_DATA_SORTS)[number];
const SORT_VALUES = MASTER_DATA_SORTS.flatMap((field) => [field, `-${field}`]);

export const RECORD_STATUSES = ['active', 'retired', 'all'] as const;
export type RecordStatus = (typeof RECORD_STATUSES)[number];

/**
 * Query of the v2 master-data lists (units, assets, products, RCA settings): keyset paging, a free-text
 * search on code and name, the active / retired filter and an allowlisted sort.
 */
export class MasterDataListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: SORT_VALUES, default: 'createdAt' })
  @IsOptional()
  @IsIn(SORT_VALUES)
  sort?: string = undefined;

  @ApiPropertyOptional({
    description: 'Case-insensitive search in code and name',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  @ApiPropertyOptional({
    enum: RECORD_STATUSES,
    default: 'all',
    description: 'active = not retired, retired = retired only, all = both',
  })
  @IsOptional()
  @IsIn(RECORD_STATUSES)
  status?: RecordStatus;
}
