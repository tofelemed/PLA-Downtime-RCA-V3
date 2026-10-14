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
  VERSION_STATES,
  VersionState,
} from '../../domain/profiles/profile.types';
import {
  DEMAND_STATUSES,
  DemandStatusValue,
} from '../../valuation/entities/demand-status.entity';
import { ListQueryDto } from '../common/list-query.dto';
import { EffectiveDto } from '../profiles/profile-v2.dto';

/** Body of POST /demand-statuses (SME V3): a draft sold-out status of a product over a validity. */
export class DemandStatusCreateDto extends EffectiveDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  productId: string;

  @ApiProperty({
    enum: DEMAND_STATUSES,
    description:
      'demand_constrained = sold out: lost tonnes are lost sales; not_constrained = inventory or catch-up covers demand',
  })
  @IsIn(DEMAND_STATUSES)
  status: DemandStatusValue;

  @ApiProperty({
    description:
      'What substantiates it: unmet orders, inventory cover, ability to catch up, affected market',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  evidence: string;
}

export class DemandStatusListQueryDto extends ListQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ enum: VERSION_STATES })
  @IsOptional()
  @IsIn(VERSION_STATES)
  state?: VersionState;
}
