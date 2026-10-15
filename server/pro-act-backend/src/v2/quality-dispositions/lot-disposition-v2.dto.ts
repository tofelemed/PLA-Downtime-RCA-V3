import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  DISPOSITION_CLASSES,
  DispositionClass,
} from '../../domain/actuals/period/quality-classes';
import {
  LOT_DISPOSITION_STATES,
  LotDispositionState,
} from '../../quality-dispositions/entities/lot-disposition.entity';
import { ListQueryDto } from '../common/list-query.dto';
import { DECIMAL } from '../profiles/profile-v2.dto';

/** Body of POST /lot-dispositions: a lot disposition or recovery movement to approve (SME E3). */
export class LotDispositionCreateDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  unitId: string;

  @ApiProperty({ format: 'uuid', description: 'Product (grade) of the lot' })
  @IsUUID()
  productId: string;

  @ApiProperty({ example: 'L-2027-0301-A', maxLength: 64 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  lotCode: string;

  @ApiProperty({
    enum: DISPOSITION_CLASSES,
    description:
      'wide_spec = intentional wide-spec grade (good, reported apart); downgrade, transition_off_grade, scrap, rework = first-pass defects; recovered = reprocessed material of an earlier disposition coming back as saleable output (needs recoveryOfId)',
  })
  @IsIn(DISPOSITION_CLASSES)
  dispositionClass: DispositionClass;

  @ApiProperty({ example: '5', description: 'Quantity > 0, decimal string' })
  @Matches(DECIMAL, {
    message: 'quantity must be a decimal string with at most 8 decimals',
  })
  quantity: string;

  @ApiProperty({ example: 't', maxLength: 50 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  uom: string;

  @ApiProperty({
    format: 'date-time',
    description:
      'Start of the production interval of the lot (of the reprocessing for a recovery); the actuals are aligned to it, not to the lab release',
  })
  @IsISO8601({ strict: true })
  productionStart: string;

  @ApiProperty({ format: 'date-time', description: 'Exclusive end' })
  @IsISO8601({ strict: true })
  productionEnd: string;

  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({ strict: true })
  labReleasedAt?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'recovered only: the approved downgrade, transition off-grade or rework this quantity recovers',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  recoveryOfId?: string | null;

  @ApiPropertyOptional({
    description:
      'recovered only: the reprocessed material passed this unit’s production meter again (it is then no new output)',
  })
  @IsOptional()
  @IsBoolean()
  remeasured?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Production event of the unit the disposition comes from',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  productionEventId?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Approved disposition of the same unit and product this one corrects; it becomes superseded on approval',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  supersedesId?: string | null;

  @ApiPropertyOptional({ nullable: true, maxLength: 2000 })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  reason?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    maxLength: 2000,
    description: 'Lab certificate, sample id or document reference',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(2000)
  evidenceRef?: string | null;
}

/** GET /lot-dispositions: overlap of the production interval with [from, to), newest first. */
export class LotDispositionListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  unitId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ maxLength: 64 })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  lotCode?: string;

  @ApiPropertyOptional({ enum: DISPOSITION_CLASSES })
  @IsOptional()
  @IsIn(DISPOSITION_CLASSES)
  dispositionClass?: DispositionClass;

  @ApiPropertyOptional({ enum: LOT_DISPOSITION_STATES })
  @IsOptional()
  @IsIn(LOT_DISPOSITION_STATES)
  state?: LotDispositionState;
}
