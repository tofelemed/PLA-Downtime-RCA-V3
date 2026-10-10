import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { toArrayParam } from '../../common/dto/query-param.transformers';
import {
  RCA_LINK_TYPES,
  RcaLinkType,
} from '../../rca/entities/rca-case-link.entity';
import { RECOMMENDATION_STATES } from '../../rca/entities/rca-trigger-evaluation.entity';
import { ListQueryDto } from '../common/list-query.dto';
import { RcaCaseV2CreateDto } from './rca-cases-v2.dto';

/**
 * `POST /v2/production-events/{id}/rca-link` (spec §15.2): link the event to an existing case
 * (`rcaId`) or create one (`create`) — exactly one of them. Linking twice is idempotent (200).
 */
export class EventRcaLinkV2Dto {
  @ApiPropertyOptional({ description: 'Existing case of your scope' })
  @IsOptional()
  @IsUUID()
  rcaId?: string;

  @ApiPropertyOptional({
    type: RcaCaseV2CreateDto,
    description:
      'New case; unit and asset default to the event’s when not given',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => RcaCaseV2CreateDto)
  create?: RcaCaseV2CreateDto;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class RcaLinkV2CreateDto {
  @ApiProperty({ enum: RCA_LINK_TYPES })
  @IsIn(RCA_LINK_TYPES)
  linkType: RcaLinkType;

  @ApiProperty({
    maxLength: 255,
    description:
      'Event, loss line or occurrence id (uuid), or the work order number',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  targetId: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  reason?: string;
}

export class RcaRecommendationV2ListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({
    type: [String],
    description: 'Events (repeat the parameter)',
  })
  @IsOptional()
  @Transform(toArrayParam)
  @IsArray()
  @ArrayMaxSize(200)
  @IsUUID('all', { each: true })
  eventIds?: string[];

  @ApiPropertyOptional({ enum: RECOMMENDATION_STATES, default: 'open' })
  @IsOptional()
  @IsIn(RECOMMENDATION_STATES)
  state?: (typeof RECOMMENDATION_STATES)[number];

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  unitId?: string;
}

export class RcaRecommendationDismissV2Dto {
  @ApiProperty({ maxLength: 2000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}
