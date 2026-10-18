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
  MinLength,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import { LOSS_VALUE_KINDS } from '../../domain/valuation/reconciled-valuation';
import { EnumArrayParam } from '../common/enum-array-param';
import { ListQueryDto } from '../common/list-query.dto';

/** Loss kinds a picker lists (the loss-value set: schedule exclusions, gains and residuals stay apart). */
export const PICKER_LOSS_KINDS: readonly string[] = [...LOSS_VALUE_KINDS];

/** `GET /api/v2/loss-lines` (UX G-3 picker): AND between parameters, OR within a repeated parameter. */
export class LossLineListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ enum: ['-periodStart'], default: '-periodStart' })
  @IsOptional()
  @IsIn(['-periodStart'])
  sort?: string = undefined;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description: 'Repeat the parameter for several units',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  unitIds?: string[];

  @ApiPropertyOptional({ type: [String], format: 'uuid' })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(100)
  @IsUUID('all', { each: true })
  reasonCodeIds?: string[];

  @EnumArrayParam(PICKER_LOSS_KINDS)
  kinds?: string[];

  @ApiPropertyOptional({
    description:
      'Text search (case-insensitive, literal) on the reason code, its name and the cause event description',
  })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q?: string;
}
