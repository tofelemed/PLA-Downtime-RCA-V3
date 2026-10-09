import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Matches,
  Min,
} from 'class-validator';
import { ListQueryDto } from '../common/list-query.dto';
import { INSTANT, INSTANT_MESSAGE } from '../profiles/profile-v2.dto';

export const ACCOUNTING_VIEWS = ['draft', 'approved'] as const;

export class PeriodAccountingQueryDto {
  @ApiPropertyOptional({
    enum: ACCOUNTING_VIEWS,
    description:
      'Which revision to show; default: the approved revision when one exists, else the draft',
  })
  @IsOptional()
  @IsIn(ACCOUNTING_VIEWS)
  view?: (typeof ACCOUNTING_VIEWS)[number];

  @ApiPropertyOptional({
    minimum: 1,
    description: 'A specific revision number (wins over view)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  revision?: number;
}

export class CalculationRunListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['-createdAt'] })
  @IsOptional()
  @IsIn(['-createdAt'])
  sort?: string = undefined;
}

export class RecalculatePeriodsDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Omit for every unit (tenant-wide grant required)',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiProperty({
    description: 'Periods overlapping [from, to), ISO 8601 with offset',
  })
  @Matches(INSTANT, { message: `from ${INSTANT_MESSAGE}` })
  from: string;

  @ApiProperty({
    description: 'Window end (exclusive); at most 92 days after from',
  })
  @Matches(INSTANT, { message: `to ${INSTANT_MESSAGE}` })
  to: string;
}
