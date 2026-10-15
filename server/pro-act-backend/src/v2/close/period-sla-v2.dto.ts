import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import {
  DATA_HOLD_KINDS,
  DataHoldKind,
} from '../../close/entities/period-data-hold.entity';

export class OpenDataHoldDto {
  @ApiProperty({
    enum: DATA_HOLD_KINDS,
    description:
      'lab = waiting for a lab result, source = a failed or late source, other',
  })
  @IsIn(DATA_HOLD_KINDS)
  kind: DataHoldKind;

  @ApiProperty({
    description: 'What the period waits for (shown to the reviewer)',
  })
  @IsString()
  @Length(1, 2000)
  reason: string;
}

export class ReleaseDataHoldDto {
  @ApiPropertyOptional({ description: 'What arrived (kept on the hold)' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
